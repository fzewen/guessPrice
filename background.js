chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      func: scrapePageInfo
    });
  } else if (msg.type === "user_input") {
    const data = msg.data;
    console.log(data);
    chrome.storage.sync.set(data);
    // saveGuess(userId, data);
    // Do something with the input value (e.g., send it to a server)
    console.log("Received input:", data);
  }
});

function scrapePageInfo() {
  console.log("here");
  const price = document.querySelector(`[data-testid="price"]`);
  const container = document.querySelector('[data-testid="listing-attribution-overview"]');

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
  const data = {
    price: price.firstElementChild.innerText,
    mlsId: mlsId
  };
  chrome.runtime.sendMessage({ action: "scrapedData", data });
}