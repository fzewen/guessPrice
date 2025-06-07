const input = document.getElementById('my-form');
const result = document.getElementById('result');
// local storage structure
// object
//     guess
//        mlsId: price, rank, winPrice
//     trend
//        lastFetchTime
//        data
input.addEventListener('input', (e) => {
  let value = e.target.value;

  // Remove all non-digit characters
  value = value.replace(/\D/g, '');

  // Add commas
  const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  e.target.value = formatted;
});

input.addEventListener('submit', function (event) {
  event.preventDefault(); // Prevent default form submission
  const price = document.getElementById('priceInput').value;
  const mlsId = document.getElementById('mlsId').innerText;
  //  Here, you can use chrome.runtime.sendMessage to send the input to your background script
  //  or use chrome.tabs.executeScript to inject code into the current page
  console.log('hhhhhh');
  console.log(mlsId);
  // const data = {[`guesses.${mlsId}`]: {price: price, status: 'Active'}};
  chrome.runtime.sendMessage({
    type: 'user_input',
    data: { mlsId: mlsId, price: price },
  });
});

const tabs = ['current', 'guessed', 'trending'];
tabs.forEach((tab) => {
  const el = document.getElementById(`tab-${tab}`);
  el.addEventListener('click', async () => {
    tabs.forEach((t) => {
      document.getElementById(`tab-${t}`).style.fontWeight = 'normal';
      document.getElementById(`${t}`).style.display = 'None';
    });
    el.style.fontWeight = 'bold';
    document.getElementById(`${tab}`).style.display = 'Block';
    if (tab == 'guessed') {
      console.log('sending  guessss messsssss');
      await loadGuess();
    } else if (tab == 'trending') {
      chrome.runtime.sendMessage({ action: 'fetchTrend' });
    }
    // TODO: show the corresponding section
    console.log(`Switched to tab: ${tab}`);
  });
});

const eligiblePages = 'https://www.zillow.com/homedetails/';

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab.url.startsWith(eligiblePages)) {
    console.log('nottttttttt');
    document.getElementById('ineligible').style.display = 'block';
    document.getElementById('eligible').style.display = 'none';
    return;
  }
  document.getElementById('eligible').style.display = 'block';
  console.log('scrapppppppppp');
  chrome.runtime.sendMessage({ action: 'scrape', tabId: tab.id });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'trendLoaded') {
      setTrend(msg.data);
    } else if (msg.action === 'clicked') {
      console.log('Clickkkkkkkk2');
      setInputStatus(true);
    } else if (msg.action === 'scrapedData') {
      document.getElementById('price').innerText = msg.data.price;
      const mlsId = msg.data.mlsId;
      document.getElementById('mlsId').innerText = mlsId;

      const loads = document.getElementById('h1s');
      loads.innerHTML = '';
      console.log(typeof mlsId);
      console.log(mlsId);
      console.log(msg);
      // await loadGuess();

      let data;
      try {
        data = await chrome.storage.sync.get('guesses');
      } catch (e) {
        // Handle error that occurred during storage initialization.
        console.log(e);
      }
      console.log('first get.....', data);
      if (msg.data.status == 'Sold') {
        setInputStatus(true);
        // the extra logic here to check against stored data
        if (data.guess && data.guesses?.[mlsId]) {
          const status = data.guesses?.[mlsId].status;
          if (status == 'Sold') {
            // load result
            result.style.display = 'block';
            document.getElementById('win').innerText =
              '&#127775 ' + data.guesses?.[mlsId].winPrice;
            document.getElementById('price').innerText =
              '&#x1F4B0 ' + data.guesses?.[mlsId].price;
            document.getElementById('rank').innerText =
              '&#127942 ' + data.guesses?.[mlsId].rank;
          } else {
            // now result pending, wait cron job to update cloud & local
            result.style.display = 'None';
          }
        }
      } else {
        setInputStatus(false);
        if (data && data.guesses?.[mlsId]) {
          console.log(data.guesses?.[mlsId].price);
          document.getElementById('priceInput').value =
            data.guesses?.[mlsId].price;
        }
      }
    }
  });
});

const setInputStatus = (status) => {
  Array.from(input.elements).forEach((element) => {
    element.disabled = status;
  });
};

const getSearchLink = (mlsId) => {
  const query = {};
  query.filterState = {};
  query.filterState.att = {};
  query.filterState.att.value = mlsId;
  const queryString = encodeURIComponent(JSON.stringify(query));
  return 'https://www.zillow.com/ca/?searchQueryState=' + queryString;
};

const loadGuess = async () => {
  const data = await chrome.storage.sync.get('guesses');
  const guessList = document.getElementById('guessList');
  guessList.innerHTML = '';
  console.log('load data...', data);
  console.log('load guess...', data.guesses);

  Object.keys(data.guesses).forEach((mlsId) => {
    const listItem = document.createElement('li');
    const mlsLink = document.createElement('a');
    mlsLink.href = getSearchLink(mlsId);
    mlsLink.innerText = mlsId;
    mlsLink.target = '_blank';

    let formattedLine = `💰 $${data.guesses?.[mlsId].price}`;
    if (data.guesses?.[mlsId].rank) {
      formattedLine += ` 🏆 $${data.guesses?.[mlsId].rank}`;
    }
    // Append elements
    listItem.appendChild(mlsLink);
    listItem.append(formattedLine);
    guessList.appendChild(listItem);
  });
};

const setTrend = (data) => {
  console.log(data);
  const trendList = document.getElementById('trendList');
  trendList.innerHTML = ''; // Clear previous entries if needed
  Object.keys(data).forEach((mlsId) => {
    const listItem = document.createElement('li');

    // First line: MLS link
    const mlsLink = document.createElement('a');
    mlsLink.href = getSearchLink(mlsId);
    mlsLink.innerText = mlsId;
    mlsLink.target = '_blank';

    // Second line: formatted info
    const infoDiv = document.createElement('div');
    infoDiv.textContent = `🔥 ${data[mlsId].accessCnt} acc 🕐 ${shortTimeAgo(
      data[mlsId].lastAcessTime
    )}`;
    infoDiv.style.fontSize = '1em';
    infoDiv.style.color = '#1976d2';
    infoDiv.style.marginTop = '2px';

    listItem.appendChild(mlsLink);
    listItem.appendChild(document.createElement('br')); // Line break
    listItem.appendChild(infoDiv);

    trendList.appendChild(listItem);
  });
};

const shortTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};

// // below are pushing testing; not working
// const SERVER_PUBLIC_KEY = 'BJ5LMVi-xpiHQs5nS5fXbWFdG9oijXK5rUb5vdSG-VqFQwayPAO3Bu_4aKw9PRbAnVTF14HQGQJvv1R0z0j4cF8';

// async function subscribeToPush() {
//   if (!('serviceWorker' in navigator)) {
//     console.error('Service workers are not supported.');
//     return;
//   }

//   try {
//     const registration = await navigator.serviceWorker.register('background.js');
//     console.log('SW registered:', registration);

//     const ready = await navigator.serviceWorker.ready;
//     const subscription = await ready.pushManager.subscribe({
//       userVisibleOnly: true,
//       applicationServerKey: urlBase64ToUint8Array(SERVER_PUBLIC_KEY)
//     });

//     console.log(`Subscribed: ${JSON.stringify(subscription,0,2)}`);

//     // Send `subscription` to your backend to save
//   } catch (err) {
//     console.error('Subscribe error:', err);
//   }
// }

// function urlBase64ToUint8Array(base64String) {
//   const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
//   const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
//   const raw = atob(base64);
//   return new Uint8Array([...raw].map(char => char.charCodeAt(0)));
// }

// subscribeToPush();
