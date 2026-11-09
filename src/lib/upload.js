// Ek dosyayı yüklemeye hazırlar: büyük fotoğraflar tarayıcıda küçültülür (en uzun kenar 1600 px, JPEG).
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

function toBase64(buffer) {
  let bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function shrinkImage(file) {
  let bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  let canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  let context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

export async function prepareUpload(file) {
  let blob = file;
  let name = file.name;
  if (COMPRESSIBLE.includes(file.type) && file.size > 300 * 1024) {
    try {
      let smaller = await shrinkImage(file);
      if (smaller && smaller.size < file.size) {
        blob = smaller;
        name = name.replace(/\.[^.]+$/, '') + '.jpg';
      }
    } catch {
      // Küçültülemezse özgün dosya gönderilir
    }
  }
  return { name, size: blob.size, data: toBase64(await blob.arrayBuffer()) };
}
