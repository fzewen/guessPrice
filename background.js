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
    updateGuess(msg.cloudData);
    // saveGuess(userId, data);
    // Do something with the input value (e.g., send it to a server)
    console.log("Received input:", data);
  }
});

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