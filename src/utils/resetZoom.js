// utils/resetZoom.js
export function resetIOSZoom() {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  const original = viewport.getAttribute('content');

  // Força o zoom de volta pra 1
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1'
  );

  // Solta o travamento logo depois, devolvendo a liberdade de zoom ao usuário
  setTimeout(() => {
    viewport.setAttribute('content', original || 'width=device-width, initial-scale=1');
  }, 300);
}