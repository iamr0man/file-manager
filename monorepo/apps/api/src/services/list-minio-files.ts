import { s3Service } from './s3';

async function main() {
  const files = await s3Service.listFiles();
  if (files.length === 0) {
    console.log('No files found in MinIO.');
    return;
  }
  console.log('Files in MinIO:');
  for (const file of files) {
    console.log(`- Key: ${file.id}, Name: ${file.name}`);
  }
}

main().catch((err) => {
  console.error('Error listing files in MinIO:', err);
  process.exit(1);
}); 