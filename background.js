// local storage structure
// object
//     guess
//        mlsId: price, rank, winPrice, url
//     trend
//        lastFetchTime
//        data

let signInuserId;
// how this get trigger each login and logout
chrome.identity.getProfileUserInfo((userInfo) => {
  signInuserId = userInfo.id;
  // Do something with userId here (e.g., send to Firebase)
});

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    // Do something, like re-fetch user data or auth token
    signInuserId = account.id;
  } else {
    // Optional: clear local storage or prompt re-auth
    signInuserId = null;
  }
});

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: scrapePageInfo
    });
  } else if (msg.type === "user_input") {
    let updateData = msg.data;
    // mls -> price, rank, status, winPrice
    // This is not very efficient, unless a global storage to load once
    let data = await chrome.storage.sync.get('guesses');
    data.guesses = data.guesses || {};
    data.guesses[updateData.mlsId] = updateData;
    chrome.storage.sync.set(data);

    updateData.userId = signInuserId;
    updateGuess(updateData);
    // saveGuess(userId, data);
    // Do something with the input value (e.g., send it to a server)
  } else if (msg.action === "fetchTrend") {
    await loadTrend();
  } else if (msg.action === 'guessesLoaded') {
    const guessCount = Object.keys(msg.data).length; // Count the number of guesses
    updateBadge(guessCount); // Update the badge with the count
  }
});

async function loadTrend() {
  let data = await chrome.storage.sync.get('trend');
  const curTime = Date.now();
  if (data && data.trend && data.trend.lastFetchTime) {
    if (curTime - data.trend.lastFetchTime < 3600 * 1000) {
      chrome.runtime.sendMessage({ action: "trendLoaded", data: data.trend.data });
      return;
    }
  }
  const params = new URLSearchParams();
  params.append('userId', signInuserId);
  const url = `https://us-central1-guessprice-a08ba.cloudfunctions.net/fetchTop?${params.toString()}`;
  fetch(url)
    .then(async response => {
      const data = await response.json();
      const trend = { trend: { lastFetchTime: curTime, data: data } };
      await chrome.storage.sync.set(trend);
      chrome.runtime.sendMessage({ action: "trendLoaded", data });
    })
    .catch(error => {
      console.error('Fetch error:', error);
    });
}

// Not fully checked
async function loadGuess() {
  const result = await chrome.storage.sync.get('guesses');
  const activeMlsIDs = Object.entries(result)
    .filter(([mlsID, info]) => info.status === 'active')
    .map(([mlsID]) => mlsID);

  const params = new URLSearchParams();
  activeMlsIDs.forEach(id => params.append('mls', id));  // mls=123&mls=456&...
  params.append('userId', signInuserId);

  const url = `https://us-central1-guessprice-a08ba.cloudfunctions.net/loadResult?${params.toString()}`;
  fetch(url)
    .then(async response => {
      const res = await response.json();
      res.forEach(async (item) => {
        let data = await chrome.storage.sync.get(`guesses`);
        data.guesses[item.mlsId].status = 'Sold';
        data.guesses[item.mlsId].rank = item.rank;
        data.guesses[item.mlsId].winPrice = item.winPrice;
        chrome.storage.sync.set(data);
      });
      updateBadge(data.length); // Update badge with the number of guesses
      chrome.runtime.sendMessage({ action: "guessesLoaded", data: data });
    })
    .catch(error => {
      console.error('Fetch error:', error);
    });
}

function updateGuess(data) {
  const url = 'https://us-central1-guessprice-a08ba.cloudfunctions.net/addGuess';
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: data })
  })
    .then(async response => {
      const text = await response.text(); // Don't parse as JSON yet
    })
    .catch(error => {
      console.error('Fetch error:', error);
    });
}

function scrapePageInfo() {
  let price = document.querySelector(`[data-testid="price"]`);
  const mlsContainer = document.querySelector('[data-testid="listing-attribution-overview"]');
  const statusContainer = document.querySelector('[data-testid="gallery-status-pill"]');
  let status = 'Unknown';
  console.log("scrapePageInfo", statusContainer);

  // // Check if statusElements are available
  // if (statusElements && statusElements.length > 1) {
  //   status = statusElements[1].textContent.trim();
  // }
  if (statusContainer) {
    const spans = statusContainer.querySelectorAll('span');
    spans.forEach(span => {
      const text = span.textContent.trim();
      console.log("status text", text);
      if (text) {
        status = text;
      }
    });
  }

  let mlsId = null;
  if (mlsContainer) {
    const spans = mlsContainer.querySelectorAll('span');
    spans.forEach(span => {
      const text = span.textContent.trim();
      if (text.startsWith("MLS#:") || text.includes("MLS#")) {
        const match = text.match(/\d{6,}/); // Looks for 'ML' followed by 6+ digits
        mlsId = match ? match[0] : null;
        mlsId = "ML" + mlsId;
      }
    });
  }

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

  chrome.runtime.sendMessage({ action: "scrapedData", data });
}

// use poll for easy implementation
chrome.runtime.onInstalled.addListener(() => {
  // fire per half day
  chrome.alarms.create("pollServer", { periodInMinutes: 720 });
});

chrome.runtime.onStartup.addListener(() => {
  // fire on chrome
  chrome.alarms.create("pollServer");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollServer") {
    loadGuess();
  }
});

function updateBadge(count) {
  // Set the badge text to the count
  chrome.action.setBadgeText({ text: count.toString() });
}

// Testing the badge update on install and startup
// chrome.runtime.onInstalled.addListener(() => {
//   updateBadge('3'); // Default badge text
// });

// chrome.runtime.onStartup.addListener(() => {
//   updateBadge('3'); // Default badge text
// });
