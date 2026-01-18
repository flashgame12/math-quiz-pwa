export const BUILD_ID = '21';

function getServiceWorkerVersionFromController() {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (!controller?.scriptURL) return null;
    const url = new URL(controller.scriptURL);
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function renderBuildBadge(buildBadgeEl) {
  if (!buildBadgeEl) return;
  const swVersion = getServiceWorkerVersionFromController();
  const swLabel = swVersion ? `sw ${swVersion}` : (navigator.serviceWorker ? 'sw —' : 'sw off');
  buildBadgeEl.textContent = `v${BUILD_ID}`;
  buildBadgeEl.title = `build ${BUILD_ID} • ${swLabel} (click to copy)`;
}

async function copyBuildInfoToClipboard(buildBadgeEl) {
  const swVersion = getServiceWorkerVersionFromController();
  const text = [
    `build=${BUILD_ID}`,
    `sw=${swVersion || 'none'}`,
    `url=${window.location.href}`
  ].join(' ');

  try {
    await navigator.clipboard.writeText(text);
    buildBadgeEl.textContent = 'copied';
    setTimeout(() => renderBuildBadge(buildBadgeEl), 900);
  } catch {
    buildBadgeEl.textContent = text;
  }
}

export function initBuildBadge(buildBadgeEl) {
  if (!buildBadgeEl) return;
  renderBuildBadge(buildBadgeEl);
  buildBadgeEl.addEventListener('click', () => void copyBuildInfoToClipboard(buildBadgeEl));

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => renderBuildBadge(buildBadgeEl));
  }
}

export function applyBuildIdToManifestLink() {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) return;

  const href = manifestLink.getAttribute('href') || 'manifest.json';
  const url = new URL(href, window.location.href);
  url.searchParams.set('v', BUILD_ID);
  manifestLink.setAttribute('href', url.toString());
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = new URL('service-worker.js', window.location.href);
    swUrl.searchParams.set('v', BUILD_ID);
    navigator.serviceWorker.register(swUrl.toString())
      .catch(err => console.log('Service Worker registration failed:', err));
  });
}
