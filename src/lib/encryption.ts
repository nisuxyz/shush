import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// Helper to convert data to Uint8Array
async function toUint8Array(data: string | File | Blob): Promise<Uint8Array> {
  if (typeof data === 'string') {
    return naclUtil.decodeUTF8(data);
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(data);
  });
}

export async function encrypt(data: string | File | Blob, password: string): Promise<{ nonce: string; blob: Blob }> {
  // Convert input to Uint8Array
  const dataArray = await toUint8Array(data);
  
  // Derive key from password
  const key = nacl.hash(naclUtil.decodeUTF8(password)).slice(0, 32);
  const nonce = nacl.randomBytes(24);

  // Encrypt the data
  const encrypted = nacl.secretbox(dataArray, nonce, key);

  // Return base64 encoded nonce and encrypted data as blob
  return {
    nonce: naclUtil.encodeBase64(nonce),
    blob: new Blob([encrypted], { type: 'application/octet-stream' })
  };
}

export async function decrypt(data: Blob, nonceBase64: string, password: string): Promise<Blob> {
  // Decode the base64 nonce back to Uint8Array
  const nonce = naclUtil.decodeBase64(nonceBase64);
  // Convert blob to Uint8Array
  const encryptedArray = await toUint8Array(data);
  
  // Derive key from password
  const key = nacl.hash(naclUtil.decodeUTF8(password)).slice(0, 32);

  // Decrypt the data
  const decrypted = nacl.secretbox.open(encryptedArray, nonce, key);

  if (!decrypted) {
    throw new Error('Incorrect password or corrupted data.');
  }

  return new Blob([decrypted], { type: 'application/octet-stream' });
}
