chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "leave" && sender.tab) {
    chrome.tabs.update(sender.tab.id, { url: "chrome://newtab" });
  }
});
