import { test, expect } from '@playwright/test';
import path from 'path';

test('Delete file via UI and verify removal', async ({ page }) => {
  // 1. Navigate to the file manager home page
  await page.goto('http://localhost:3000');

  // 2. Wait for the file list to load
  await expect(page.getByRole('heading', { name: 'File Manager' })).toBeVisible();

  // 3. Upload the test file (test-file.txt) via the upload area
  const filePath = path.resolve(__dirname, '../test-file.txt');
  // Click the upload area to open file chooser
  const uploadArea = page.getByText('Drag files here or click to select');
  await uploadArea.click();
  // Upload the file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadArea.click(),
  ]);
  await fileChooser.setFiles(filePath);

  // 4. Wait for the new test-file.txt row to appear in the table
  const newFileRow = page.getByRole('row', { name: /test-file\.txt \d+\.0 B .+ Actions/ });
  await expect(newFileRow).toBeVisible();

  // 5. Click the delete (trash) button for the latest test-file.txt row
  // Find the delete button (last button in the actions cell)
  const deleteButton = newFileRow.getByRole('button').nth(2);
  await deleteButton.click();

  // 6. Wait for the file to be removed from the table (verify the latest test-file.txt row is gone)
  await expect(newFileRow).not.toBeVisible();
}); 