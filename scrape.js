const input = document.getElementById('my-form');
const result = document.getElementById('result');
const submitInfo = document.getElementById('submitInfo');
const loadingIndicator = document.getElementById('loading-indicator');
let curUrl;
let curMlsId;

input.addEventListener('click', () => {
  submitInfo.innerText = '';
});

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
  const status = document.getElementById('status-text').innerText;
  if (price === '') {
    submitInfo.innerText = '❌ Please enter a price.';
    return;
  }
  const data = {
    mlsId: mlsId,
    price: price,
    url: curUrl,
    status: status,
    updateTime: Date.now(),
  };
  chrome.runtime.sendMessage({
    type: 'user_input',
    data,
  });
  submitInfo.innerText = '✅ Guess submitted successfully!';
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
      await loadGuess();
    } else if (tab == 'trending') {
      // Show the loading indicator and clear the trend list
      loadingIndicator.style.display = 'block';
      chrome.runtime.sendMessage({ action: 'fetchTrend' });
    }
  });
});

const eligiblePages = 'https://www.zillow.com/homedetails/';

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  curUrl = tab.url;
  if (!tab.url.startsWith(eligiblePages)) {
    document.getElementById('ineligible').style.display = 'block';
    document.getElementById('eligible').style.display = 'none';
  } else {
    document.getElementById('eligible').style.display = 'block';
    chrome.runtime.sendMessage({ action: 'scrape', tabId: tab.id });
  }
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'trendLoaded') {
      setTrend(msg.data);
    } else if (msg.action === 'clicked') {
      setInputStatus(true);
    } else if (msg.action === 'guessesLoaded') {
      // set icon with number of guesses
      // similar on the guesses tab
    } else if (msg.action === 'scrapedData') {
      document.getElementById('price').innerText = msg.data.price;
      const mlsId = msg.data.mlsId;
      if (!mlsId) {
        document.getElementById('ineligible').style.display = 'block';
        document.getElementById('eligible').style.display = 'none';
        return;
      }
      curMlsId = mlsId;
      document.getElementById('mlsId').innerText = mlsId;

      const loads = document.getElementById('h1s');
      loads.innerHTML = '';
      updateStatus(msg.data.status);

      let data;
      try {
        data = await chrome.storage.sync.get('guesses');
      } catch (e) {
        // Handle error that occurred during storage initialization.
      }
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
  const filterSelect = document.getElementById('filter-select');
  let pagination = document.getElementById('pagination');

  // Check if pagination already exists
  if (!pagination) {
    pagination = document.createElement('div');
    pagination.id = 'pagination'; // Use CSS class for styling
    guessList.parentNode.appendChild(pagination); // Append only if it doesn't exist
  }

  guessList.innerHTML = '';
  pagination.innerHTML = '';

  let guesses = Object.keys(data.guesses);

  // Sort items by updateTime by default
  guesses.sort((a, b) => {
    const timeA = data.guesses?.[a]?.updateTime || 0;
    const timeB = data.guesses?.[b]?.updateTime || 0;
    return timeB - timeA; // Descending order
  });

  // Filter items based on selected status
  const filterStatus = filterSelect.value;
  if (filterStatus === 'other') {
    guesses = guesses.filter(
      (mlsId) =>
        data.guesses?.[mlsId]?.status !== 'For sale' &&
        data.guesses?.[mlsId]?.status !== 'Sold'
    );
  } else if (filterStatus !== 'all') {
    guesses = guesses.filter((mlsId) => data.guesses?.[mlsId]?.status === filterStatus);
  }

  const itemsPerPage = 5;
  const totalPages = Math.ceil(guesses.length / itemsPerPage);

  const renderPage = (page) => {
    guessList.innerHTML = '';
    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, guesses.length);

    for (let i = start; i < end; i++) {
      const mlsId = guesses[i];
      const listItem = document.createElement('li');
      listItem.className = 'guess-item'; // Add a class for styling

      // Create the status pill
      const statusPill = document.createElement('span');
      statusPill.className = 'status-pill'; // Base class for the pill

      // Update the status pill color using CSS classes
      const status = data.guesses?.[mlsId]?.status || 'Unknown';
      if (status === 'For sale') {
        statusPill.classList.add('green');
      } else if (status === 'Sold') {
        statusPill.classList.add('red');
      } else {
        statusPill.classList.add('yellow');
      }

      // Create the MLS link
      const mlsLink = document.createElement('a');
      mlsLink.href = data.guesses?.[mlsId]?.url ?? getSearchLink(mlsId);
      mlsLink.innerText = mlsId;
      mlsLink.target = '_blank';

      // Create the formatted line element
      const formattedLineElement = document.createElement('span');
      let formattedLine = `💰 $${data.guesses?.[mlsId].price}`;
      if (data.guesses?.[mlsId].rank) {
        formattedLine += ` 🏆 ${data.guesses?.[mlsId].rank}`;
      }
      formattedLineElement.innerText = formattedLine;

      // Append the status pill, MLS link, and formatted line to the list item
      listItem.appendChild(statusPill);
      listItem.appendChild(mlsLink);
      listItem.appendChild(document.createElement('br')); // Add a line break
      listItem.appendChild(formattedLineElement);
      guessList.appendChild(listItem);
    }
  };

  const renderPagination = () => {
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement('button');
      pageButton.innerText = i;
      pageButton.className = 'pagination-button'; // Add a class for styling
      pageButton.addEventListener('click', () => renderPage(i));
      pagination.appendChild(pageButton);
    }
  };

  if (guesses.length > 0) {
    renderPage(1);
    if (totalPages > 1) {
      renderPagination();
    }
  }
};

// Add event listener for the filter dropdown
document.getElementById('filter-select').addEventListener('change', loadGuess);

const setTrend = (data) => {
  // Hide the loading indicator
  loadingIndicator.style.display = 'none';
  const trendList = document.getElementById('trendList');
  trendList.innerHTML = ''; // Clear previous entries if needed
  Object.keys(data).forEach((mlsId) => {
    const listItem = document.createElement('li');

    // First line: MLS link
    const mlsLink = document.createElement('a');
    mlsLink.href = data[mlsId].url ?? getSearchLink(mlsId);
    mlsLink.innerText = mlsId;
    mlsLink.target = '_blank';

    // Second line: formatted info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'trend-info'; // Use CSS class for styling
    infoDiv.textContent = `🔥 ${data[mlsId].accessCnt} acc 🕐 ${shortTimeAgo(
      data[mlsId].lastAcessTime
    )}`;

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

const updateStatus = (status) => {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Update the status text
  statusText.innerText = status;

  // Update the color of the dot based on the status
  statusDot.className = 'status-dot'; // Reset classes
  if (status === 'For sale') {
    statusDot.classList.add('green');
  } else if (status === 'Sold') {
    statusDot.classList.add('red');
  } else {
    statusDot.classList.add('yellow');
  }
};
