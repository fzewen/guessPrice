let signInuserId;
// how this get trigger each login and logout
chrome.identity.getProfileUserInfo((userInfo) => {
  signInuserId = userInfo.id;
  console.log('Got user ID:', signInuserId);
  // Do something with userId here (e.g., send to Firebase)
});

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log('User signed in:', account.email);
    // Do something, like re-fetch user data or auth token
    signInuserId = account.id;
  } else {
    console.log('User signed out');
    // Optional: clear local storage or prompt re-auth
    signInuserId = null;
  }
});

chrome.action.onClicked.addListener((tab) => {
  // the sold disable not working from time to time, this fix sitll not work
  console.log('Clickkkkkkkk1');
  chrome.runtime.sendMessage({ action: 'clicked' });
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === 'scrape') {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: scrapePageInfo,
    });
  } else if (msg.type === 'user_input') {
    let updateData = msg.data;
    console.log(updateData);
    // mls -> price, rank, status, winPrice
    // This is not very efficient, unless a global storage to load once
    let data = await chrome.storage.sync.get('guesses');
    data.guesses = data.guesses || {};
    data.guesses[updateData.mlsId] = {
      price: updateData.price,
      status: 'Active',
    };
    chrome.storage.sync.set(data);

    updateData.userId = signInuserId;
    updateGuess(updateData);
    // saveGuess(userId, data);
    // Do something with the input value (e.g., send it to a server)
    console.log('Received input:', data);
  } else if (msg.action === 'fetchTrend') {
    console.log('sending fetcccc trend messsssss');
    await loadTrend();
  }
});

async function loadTrend() {
  let data = await chrome.storage.sync.get('trend');
  console.log('at toppppp');
  console.log('load trendddd...', data);
  const curTime = Date.now();
  console.log('load trendddd...', curTime);
  if (data && data.trend && data.trend.lastFetchTime) {
    if (curTime - data.trend.lastFetchTime < 3600 * 1000) {
      console.log('load trend from local.....');
      chrome.runtime.sendMessage({
        action: 'trendLoaded',
        data: data.trend.data,
      });
      return;
    }
  }
  const params = new URLSearchParams();
  params.append('userId', signInuserId);
  const url = `https://us-central1-guessprice-a08ba.cloudfunctions.net/fetchTop?${params.toString()}`;
  // const url = `http://127.0.0.1:5001/guessprice-a08ba/us-central1/fetchTop?${params.toString()}`;
  console.log(url);
  fetch(url)
    .then(async (response) => {
      const data = await response.json();

      //const data = {guesses: {[`${mlsId}`]: { price: price, status: 'Active' }}};
      const trend = { trend: { lastFetchTime: curTime, data: data } };
      await chrome.storage.sync.set(trend);
      console.log('load trend from cloud.....');
      console.log(trend);
      chrome.runtime.sendMessage({ action: 'trendLoaded', data });
    })
    .catch((error) => {
      console.error('Fetch error:', error);
    });
}

// Not fully checked
async function loadGuess() {
  const result = await chrome.storage.sync.get('guesses');
  const activeMlsIDs = Object.entries(result)
    .filter(([mlsID, info]) => info.status === 'active')
    .map(([mlsID]) => mlsID);

  console.log(activeMlsIDs);
  const params = new URLSearchParams();
  activeMlsIDs.forEach((id) => params.append('mls', id)); // mls=123&mls=456&...
  params.append('userId', signInuserId);

  const url = `https://us-central1-guessprice-a08ba.cloudfunctions.net/loadResult?${params.toString()}`;
  fetch(url)
    .then(async (response) => {
      const res = await response.json();
      // {mlsId: {rank, winPrice}}
      res.forEach(async (item) => {
        // update
        let data = await chrome.storage.sync.get(`guesses`);
        console.log('load guesssss', data);
        data.guesses[item.mlsId].status = 'Sold';
        data.guesses[item.mlsId].rank = item.rank;
        data.guesses[item.mlsId].winPrice = item.winPrice;
        console.log(data);
        chrome.storage.sync.set(data);
      });
    })
    .catch((error) => {
      console.error('Fetch error:', error);
    });
}

function updateGuess(data) {
  const url =
    'https://us-central1-guessprice-a08ba.cloudfunctions.net/addGuess';
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: data }),
  })
    .then(async (response) => {
      const text = await response.text(); // Don't parse as JSON yet
      console.log('Raw response:', text);
    })
    .catch((error) => {
      console.error('Fetch error:', error);
    });
}

function scrapePageInfo() {
  console.log('here');
  let price = document.querySelector(`[data-testid="price"]`);
  const container = document.querySelector(
    '[data-testid="listing-attribution-overview"]'
  );
  const statusElement = document.querySelector(
    '[data-testid="chip-status-pill"] span:last-child'
  );
  const status = statusElement?.innerText.trim();

  let mlsId = null;

  if (container) {
    console.log('oookkkkk');
    const spans = container.querySelectorAll('span');

    spans.forEach((span) => {
      const text = span.textContent.trim();
      // console.log(text);
      // console.log(text.startsWith("MLS#:"));
      // console.log(text.includes("MLS#"));
      if (text.startsWith('MLS#:') || text.includes('MLS#')) {
        console.log('innn');
        const match = text.match(/\d{6,}/); // Looks for 'ML' followed by 6+ digits
        mlsId = match ? match[0] : null;
        mlsId = 'ML' + mlsId;
      }
    });
  }
  console.log('scarpinnnnnng');
  console.log(mlsId);
  console.log(status);
  let priceText;
  if (!price) {
    const priceElement = document.getElementsByClassName('price-text')[0];
    priceText = priceElement?.textContent.trim();
  } else {
    priceText = price.firstElementChild.innerText;
  }
  const data = {
    price: priceText,
    mlsId: mlsId,
    status: status,
  };
  chrome.runtime.sendMessage({ action: 'scrapedData', data });
}

// use poll for easy implementation
chrome.runtime.onInstalled.addListener(() => {
  // fire per half day
  chrome.alarms.create('pollServer', { periodInMinutes: 720 });
});

chrome.runtime.onStartup.addListener(() => {
  // fire on chrome
  chrome.alarms.create('pollServer');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollServer') {
    loadGuess();
  }
});

// below are push testing
// self.addEventListener('push', function(event) {
//   const data = event.data?.json() || {};
//   console.log('Push received:', data);

//   const title = data.title || 'New Notification';
//   const options = {
//     body: data.body || 'You have a new message.',
//     icon: '/images/icon-32.png'
//   };

//   // *notification not working
//   event.waitUntil(self.registration.showNotification(title, options));
// });
