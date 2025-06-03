const input = document.getElementById("my-form");
const result = document.getElementById("result");
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
  const data = {[mlsId]: {price: price, status: 'Active'}};
  console.log(data);
  const cData = {
    mlsId: mlsId,
    price: price,
  };
  chrome.runtime.sendMessage({ type: "user_input", localData: data, cloudData: cData});
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
  console.log("scrapppppppppp");
  chrome.runtime.sendMessage({ action: "scrape", tabId: tab.id });

  chrome.runtime.onMessage.addListener(async(msg) => {
    if (msg.action === "clicked") {
      console.log("Clickkkkkkkk2");
      setInputStatus(true);
    } else if (msg.action === "scrapedData") {
      document.getElementById("price").innerText = msg.data.price;
      const mlsId = msg.data.mlsId;
      document.getElementById("mlsId").innerText = mlsId;

      const loads = document.getElementById("h1s");
      loads.innerHTML = "";
      console.log(typeof mlsId);
      console.log(mlsId);
      console.log(msg);
      let data;
      try {
        data = await chrome.storage.sync.get(mlsId);
      } catch (e) {
        // Handle error that occurred during storage initialization.
        console.log(e);
      }
      if (msg.data.status == 'Sold') {
        setInputStatus(true);
        // the extra logic here to check against stored data
        if (data && data[mlsId]) {
          const status = data[mlsId].status;
          if (status == 'Sold') {
            // load result
            result.style.display = 'block';
            document.getElementById("win").innerText = '&#127775 ' + data[mlsId].winPrice;
            document.getElementById("price").innerText = '&#x1F4B0 ' + data[mlsId].price;
            document.getElementById("rank").innerText = '&#127942 ' + data[mlsId].rank;
          } else {
            // now result pending, wait cron job to update cloud & local
            result.style.display = 'None';
          }
        }
      } else {
        setInputStatus(false);
        if (data && data[mlsId]) {
          console.log(data[mlsId].price);
          document.getElementById("priceInput").value = data[mlsId].price;
        }
      }
    }
  });
});

const setInputStatus = (status) => {
  Array.from(input.elements).forEach(element => {
    element.disabled = status;
  });
}

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