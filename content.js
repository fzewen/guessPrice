const propertyCards = document.querySelectorAll(`[data-test="PropertyListCard-wrapper"]`);
propertyCards.forEach(async(card) => {
  const priceRow = card.querySelector(`[data-testid="data-price-row"]`);
  const divs = card.querySelectorAll('div');
  let mlsId = null;
  divs.forEach(div => {
    const text = div.textContent.trim();
    if (text.startsWith("MLS ID")) {
      const match = text.match(/ML\d{6,}/); // Looks for 'ML' followed by 6+ digits
      mlsId = match ? match[0] : null;
    }
  });
  console.log("pagggggg");
  console.log(mlsId);
  try {
    data = await chrome.storage.sync.get(mlsId);
  } catch (e) {
    // Handle error that occurred during storage initialization.
    console.log(e);
  }
  console.log(data);
  if (data && data[mlsId]) {
    const guessPrice = document.createElement("p");
    // const formatedPrice = Number(data[mlsId]).toLocaleString();
    console.log(data[mlsId]);
    let formatedLine = `💰 $${data[mlsId].price}`;
    if (data[mlsId].rank) {
      formatedLine += ` 🏆 $${data[mlsId].rank}`;
    }
    guessPrice.textContent = formatedLine
    priceRow.parentNode.insertAdjacentElement("afterend", guessPrice);  
  }
});