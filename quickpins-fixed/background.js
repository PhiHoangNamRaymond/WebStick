// Service worker: pre-caches active tab info so popup reads it synchronously
// from storage instead of waiting for tabs API round-trip.

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab?.url) cacheTab(tab)
  } catch (_) {}
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) cacheTab(tab)
})

function cacheTab(tab) {
  // Chỉ cache http/https — bỏ qua chrome://, chrome-extension://, about:, file:, v.v.
  if (!tab.url.startsWith('http:') && !tab.url.startsWith('https:')) return
  // Only cache url + title — favicon is now fetched via chrome://favicon2/ in popup
  chrome.storage.session.set({
    activeTab: {
      url: tab.url,
      title: tab.title || tab.url
    }
  }).catch(() => {})
}
