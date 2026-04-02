const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const app = initializeApp({
  credential: cert({
    projectId: 'tugba-auditpro',
    clientEmail: 'firebase-adminsdk-fbsvc@tugba-auditpro.iam.gserviceaccount.com',
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDN7ARbm/DSD67V
k5JagbTMgtlV/ES3N8aZ7h8GaIx3fGnzJM6Uz8R9zsM8+f9kmc8YiSetGwSIh1HC
kwkc1JHC08zL1Yi4SUKRkorPdKZmSHqA6pcu1q1uoXQDcLQJ2QGIuzlZHYenJL6b
NdQXQL2vLXs662ZdvJyzqgam3K/vtPgapWzQzWe8OncsN4VWEO2ehV1UlF/B+AHu
OjM9g1W7bnY9xMkgUuz28Z9uF1BGdJ4K+ZiXuIQjLZq8YfOsoLFe15p3zmiUQMLc
Fbh0Ej1ij9noS4PWW1EBxgNlGZQyqX3TbH5Q7wFhB0lMjfC33IzZfJoOBASQcDVQ
1Askcs4xAgMBAAECggEAHwmR5pTsiVzfx0VE6+tc6u5V/8XUPaFkh9MCTh73/RJ9
ja5gjMF8JlJBzzEHM4yTUGlr14WY+1MaGa+70eKgTbNKzPZUcyJnrDVgQsCcTBJk
lIXHX8HvxhsDt3kHSeyxdIBztmDjD2hUamSEoTSa4oqCZnEQrtQ88j+QXRoqUoC4
06dDvC5Hk7E0n4RpwifOrAhCY7V2OcQV/FZR6jFZhTY/vMdp5LaEY3Lp/VW+YWoX
UeKc5PA6fioXdDInOXKk/FH+KWyO/uNuBU686QdwbXmSy0s/cj0BulIDeHe/ZECn
UXOU+UqihemdyjBUmGyB2BHms/FQKTIKPT4LZ9AemQKBgQD80tEjG8v8Prt4VyVX
BlYydWJ5R6qdC7PMhrgkaQiXWsEQyEoDCdr+lozdHRaUW3Oglz/BPcMRwVJ1A+g9
9jLsvBxMzcv6qlat+/oWx9vwuAMGccPyDmZ6LbF7cJuwiVxs+S0BjXRdQQHoNpAX
hx7NYIvN0oo2M7tftobFrwWgXwKBgQDQglh57O6psJUeo34QFBTl3+zEVHIU1Z3v
1ZeP09MgESwnVkxrER595rWUisBDERajDppOk9OQLPjOKxZCMEpAcCt0wsRFf7Lo
iiZ1dzr6fP1LloJQsWXIYnhq3VfL0YWTADfA2UJAl8AJBxzS5i191nPp4m1qXUV2
GCS4vM/bbwKBgEM6f/hZBOYffFRkv/4jJjqmsjfT0c+O9BG35TFxaKJutJYU3HFw
ZnZ6bBzEBmQO6XFTptVo6f1HrfiFwHTxidsfrlrSAqK2NvRu47K5FIgvNka5a8Rr
Bd8JVX+gkxXfgN9NZyVZiw7dIXexQqGvAYbVXHevu6bsHLA35iCdCN77AoGBAI3K
xg4L8HTWz2FpfvXCIj/8mg8c+gNvDRsmng3B18Xrx6HsjsUUfC7T8FFWVc6F1WYH
LSoYXvuhiYTySg2ytxvA69xYAo7cezalk+e3sBTdYIbBkFb9fCDbzdWmNek1z2ca
888iL2qrh3zcKF7HBtKXPnYjc5KsYOshGf/C7nrjAoGBALgQrLBRFlIb/m8PwHu1
1AiBb7iYJtkPrMaTALq6o2BZFUJFQcHO5EczzRVs9U7V5Ocwt8a62FtKjanOzTXk
yy/ToKps4IviwEP7R0hS2uL6U80mPP15ki6yos4IDvOEln5IChy9c7pjfqZPzRNx
SMYx42ZV3syKHN7ccry4hrmg
-----END PRIVATE KEY-----`
  }),
  storageBucket: 'tugba-auditpro.firebasestorage.app'
});

const storage = getStorage(app);
const bucket = storage.bucket();

async function listFiles() {
  try {
    console.log('Listing files in actions/ALSANCAK - 31.03.2026/...');
    const [files] = await bucket.getFiles({ prefix: 'actions/ALSANCAK - 31.03.2026/' });
    
    console.log(`\nFound ${files.length} files:\n`);
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const token = metadata.metadata?.firebaseStorageDownloadTokens || '';
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/tugba-auditpro.firebasestorage.app/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`;
      
      console.log('File:', file.name);
      console.log('Size:', metadata.size, 'bytes');
      console.log('Updated:', metadata.updated);
      console.log('URL:', downloadUrl);
      console.log('');
    }
    
    if (files.length === 0) {
      console.log('No files found. Let me check more broadly...');
      const [allFiles] = await bucket.getFiles({ prefix: 'actions/' });
      console.log(`All files in actions/: ${allFiles.length}`);
      allFiles.slice(0, 20).forEach(f => console.log(' -', f.name));
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

listFiles();
