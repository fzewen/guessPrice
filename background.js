let signInuserId;
// how this get trigger each login and logout
chrome.identity.getProfileUserInfo((userInfo) => {
  signInuserId = userInfo.id;
  console.log("Got user ID:", signInuserId);
  // Do something with userId here (e.g., send to Firebase)
});

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log("User signed in:", account.email);
    // Do something, like re-fetch user data or auth token
    signInuserId = account.id;
  } else {
    console.log("User signed out");
    // Optional: clear local storage or prompt re-auth
    signInuserId = null;
  }
});

chrome.action.onClicked.addListener((tab) => {
  // the sold disable not working from time to time, this fix sitll not work
  console.log("Clickkkkkkkk1");
  chrome.runtime.sendMessage({ action: "clicked"});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: scrapePageInfo
    });
  } else if (msg.type === "user_input") {
    const data = msg.localData;
    console.log(data);
    console.log(msg.cloudData);
    // mls -> price, rank, status, winPrice
    chrome.storage.sync.set(data);
    const cloudData = msg.cloudData;
    cloudData.userId = signInuserId;
    updateGuess(cloudData);
    // saveGuess(userId, data);
    // Do something with the input value (e.g., send it to a server)
    console.log("Received input:", data);
  }
});

// This will only load active case
// server will return sold case within them
async function loadGuess() {
  const result = await chrome.storage.sync.get();
  const activeMlsIDs = Object.entries(result)
  .filter(([mlsID, info]) => info.status === 'active')
  .map(([mlsID]) => mlsID);

  console.log(activeMlsIDs);
  const params = new URLSearchParams();
  activeMlsIDs.forEach(id => params.append('mls', id));  // mls=123&mls=456&...
  params.append('userId', signInuserId);

  const url = `https://us-central1-guessprice-a08ba.cloudfunctions.net/loadResult?${params.toString()}`;
  fetch(url)
  .then(async response => {
    const res = await response.json();
    // {mlsId: {rank, winPrice}}
    res.forEach(async(item) => {
      // update
      let data = await chrome.storage.sync.get(item.mlsId);
      data[item.mlsId].status = 'Sold';
      data[item.mlsId].rank = item.rank;
      data[item.mlsId].winPrice = item.winPrice;
      console.log(data);
      chrome.storage.sync.set(data);
    });
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
    body: JSON.stringify({data: data})
  })
  .then(async response => {
    const text = await response.text(); // Don't parse as JSON yet
    console.log('Raw response:', text);
  })
  .catch(error => {
    console.error('Fetch error:', error);
  });
}

function scrapePageInfo() {
  console.log("here");
  const price = document.querySelector(`[data-testid="price"]`);
  const container = document.querySelector('[data-testid="listing-attribution-overview"]');
  const statusElement = document.querySelector('[data-testid="chip-status-pill"] span:last-child');
  const status = statusElement?.innerText.trim();

  let mlsId = null;

  if (container) {
    console.log("oookkkkk");
    const spans = container.querySelectorAll('span');

    spans.forEach(span => {
      const text = span.textContent.trim();
      // console.log(text);
      if (text.startsWith("MLS#:") || text.includes("MLS#")) {
        const match = text.match(/ML\d{6,}/); // Looks for 'ML' followed by 6+ digits
        mlsId = match ? match[0] : null;
      }
    });
  }
  console.log("scarpinnnnnng");
  console.log(mlsId);
  console.log(status);
  const data = {
    price: price.firstElementChild.innerText,
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
