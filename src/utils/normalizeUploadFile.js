const stripDataUrlPrefix = (value) => {
  const s = String(value || '');
  const idx = s.indexOf('base64,');
  return idx >= 0 ? s.slice(idx + 'base64,'.length) : s;
};

const base64ToBlob = (base64, mimeType) => {
  const raw = atob(stripDataUrlPrefix(base64));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
};

const blobToFile = (blob, fileName, mimeType) => {
  const name = fileName || 'upload';
  const type = mimeType || blob?.type || 'application/octet-stream';

  try {
    return new File([blob], name, { type });
  } catch (_) {
    blob.name = name;
    blob.type = type;
    return blob;
  }
};

const getCapacitorFilesystem = () => {
  try {
    const cap = globalThis?.Capacitor;
    const fs = cap?.Plugins?.Filesystem;
    if (fs?.readFile) return fs;
  } catch (_) {
    // ignore
  }
  return null;
};

export async function normalizeUploadFile(input, { fileName, mimeType } = {}) {
  if (!input) throw new Error('No file selected');

  const candidateName = fileName || input?.name || 'upload';
  const candidateType = mimeType || input?.type || 'application/octet-stream';

  if (typeof input?.arrayBuffer === 'function') {
    try {
      const buf = await input.arrayBuffer();
      return blobToFile(new Blob([buf], { type: candidateType }), candidateName, candidateType);
    } catch (_) {
      // ignore
    }
  }

  const uri =
    (typeof input?.uri === 'string' && input.uri) ||
    (typeof input?.path === 'string' && input.path) ||
    (typeof input === 'string' && input);

  if (uri) {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return blobToFile(blob, candidateName, candidateType || blob.type);
    } catch (_) {
      // ignore
    }

    try {
      const Filesystem = getCapacitorFilesystem();
      if (Filesystem) {
        const readRes = await Filesystem.readFile({ path: uri });
        const blob = base64ToBlob(readRes?.data, candidateType);
        return blobToFile(blob, candidateName, candidateType);
      }
    } catch (_) {
      // ignore
    }
  }

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      const objUrl = URL.createObjectURL(input);
      try {
        const res = await fetch(objUrl);
        const blob = await res.blob();
        return blobToFile(blob, candidateName, candidateType || blob.type);
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    } catch (_) {
      // ignore
    }
  }

  throw new Error('The requested file could not be read. Please try selecting it again.');
}
