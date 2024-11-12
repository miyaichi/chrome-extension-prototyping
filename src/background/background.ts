// src/background/background.ts
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.action.onClicked.addListener(async (tab) => {
  // If a tab exists, get the window ID of that tab
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});