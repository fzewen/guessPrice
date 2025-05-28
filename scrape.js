export let userId;
// how this get trigger each login and logout
chrome.identity.getProfileUserInfo((userInfo) => {
  userId = userInfo.id;
  console.log("Got user ID:", userId);
  // Do something with userId here (e.g., send to Firebase)
});

chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  if (signedIn) {
    console.log("User signed in:", account.email);
    // Do something, like re-fetch user data or auth token
    userId = account.id;
  } else {
    console.log("User signed out");
    // Optional: clear local storage or prompt re-auth
    userId = null;
  }
});

const input = document.getElementById("my-form");
input.addEventListener('input', (e) => {
  let value = e.target.value;

  // Remove all non-digit characters
  value = value.replace(/\D/g, '');

  // Add commas
  const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  e.target.value = formatted;
});

input.addEventListener("submit", function(event) {
  event.preventDefault(); // Prevent default form submission
  const price = document.getElementById("priceInput").value;
  const mlsId = document.getElementById("mlsId").innerText;
  //  Here, you can use chrome.runtime.sendMessage to send the input to your background script
  //  or use chrome.tabs.executeScript to inject code into the current page
  console.log("hhhhhh");
  console.log(mlsId);
  const data = {[mlsId]: price};
  console.log(data);
  chrome.runtime.sendMessage({ type: "user_input", data: data });
});

const eligiblePages = 'https://www.zillow.com/homedetails/';
const favPages = 'https://www.zillow.com/myzillow/favorites';

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];  
  if (tab.url.startsWith(favPages)) {
    document.getElementById("favorate").style.display = 'block';
    document.getElementById("eligible").style.display = 'none';
    return;
  } else if (!tab.url.startsWith(eligiblePages) ) {
    console.log("nottttttttt");
    document.getElementById("ineligible").style.display = 'block'; 
    document.getElementById("eligible").style.display = 'none';
    return;
  } 
  document.getElementById("eligible").style.display = 'block';

  chrome.runtime.sendMessage({ action: "scrape", tabId: tab.id });

  chrome.runtime.onMessage.addListener(async(msg) => {
    if (msg.action === "scrapedData") {
      document.getElementById("price").innerText = msg.data.price;
      const mlsId = msg.data.mlsId;
      document.getElementById("mlsId").innerText = mlsId;

      const loads = document.getElementById("h1s");
      loads.innerHTML = "";
      console.log(typeof mlsId);
      console.log(mlsId);
      var data;

      try {
        data = await chrome.storage.sync.get(mlsId);
      } catch (e) {
        // Handle error that occurred during storage initialization.
        console.log(e);
      }
      // console.log(data);
      // console.log(data[mlsId]);
      if (data && data[mlsId]) {
        document.getElementById("priceInput").value = data[mlsId];
      }

    }
  });
});
