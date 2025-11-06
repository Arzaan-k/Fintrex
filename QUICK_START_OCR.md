# Quick Start: Testing OCR Functionality

## 🚀 Immediate Testing (No API Keys Required!)

The OCR system works **out of the box** with Tesseract.js - no configuration needed!

### Step 1: Access the OCR Test Panel

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:8080/ocr-test`

3. You should see the **OCR Test Panel** with:
   - Document upload area
   - OCR processing chain information
   - Results display area

### Step 2: Test with a Document

1. **Drag and drop** or **click to upload**:
   - Images: JPEG, PNG, WebP
   - Documents: PDF files

2. Watch the processing:
   - Progress indicator shows OCR status
   - Processing time is displayed
   - Confidence score indicates accuracy

3. View results:
   - Extracted text appears in a scrollable box
   - Confidence badge (green = high, yellow = medium, red = low)
   - Character count and processing time
   - Copy button to clipboard

### Step 3: Test Different Document Types

Try these document types to see the OCR in action:

- ✅ **Invoices**: GST invoices, purchase orders
- ✅ **Receipts**: Store receipts, payment receipts
- ✅ **Bank Statements**: Transaction lists
- ✅ **ID Documents**: PAN cards, Aadhaar (for KYC)
- ✅ **Handwritten Notes**: (works best with DeepSeek/Gemini)

## 📊 Expected Results

### With Tesseract Only (No API Keys)
- **Clean printed documents**: 85-95% accuracy
- **Processing time**: 2-5 seconds per page
- **Cost**: $0 (100% free, runs in browser)

### With Optional API Keys
- **Complex documents**: 90-98% accuracy
- **Handwritten text**: Significantly better
- **Structured data**: Automatic field extraction

## 🔧 Optional: Enable Advanced OCR (Free Tier)

### Option 1: DeepSeek Vision (Recommended)

1. Get free API key: https://platform.deepseek.com/
2. Add to `.env`:
   ```bash
   VITE_DEEPSEEK_API_KEY=sk-your-key-here
   ```
3. Restart dev server
4. Test with complex documents

### Option 2: Google Gemini

1. Get free API key: https://makersuite.google.com/app/apikey
2. Add to `.env`:
   ```bash
   VITE_GEMINI_API_KEY=your-key-here
   ```
3. Restart dev server
4. Test with invoices/receipts

### Option 3: Google Cloud Vision (Best Accuracy)

1. Create project: https://console.cloud.google.com/
2. Enable Cloud Vision API
3. Create API key
4. Add to `.env`:
   ```bash
   VITE_GOOGLE_VISION_API_KEY=your-key-here
   ```
5. Restart dev server

## 🧪 Testing in Document Processing Flow

### Test End-to-End Document Processing

1. Navigate to `/documents`
2. Click "Upload Document"
3. Select a client
4. Upload an invoice/receipt
5. Click "Process" button
6. Watch the OCR extract data automatically
7. View created financial records in `/financials`

### What Gets Extracted

The OCR automatically extracts:
- ✅ Invoice number
- ✅ Invoice date
- ✅ Vendor name and GSTIN
- ✅ Customer name and GSTIN
- ✅ Line items with quantities and prices
- ✅ Tax details (CGST, SGST, IGST)
- ✅ Total amount
- ✅ Currency

## 📈 Monitoring OCR Performance

### Check Console Logs

Open browser DevTools (F12) and look for:

```
🤖 TESSERACT OCR: Starting processing...
📁 PROCESSING: invoice.pdf | application/pdf | 245.3KB
OCR Progress: 45%
OCR Progress: 78%
OCR Progress: 100%
📊 TESSERACT RESULTS:
   Document Type: invoice
   Confidence: 89.5%
   Text Length: 1234 chars
   Processing Time: 3456ms
✅ Document processed successfully
```

### Performance Indicators

- **Confidence > 80%**: Excellent, data is reliable
- **Confidence 60-80%**: Good, may need manual review
- **Confidence < 60%**: Poor, consider using advanced OCR

## 🐛 Troubleshooting

### OCR Not Working?

1. **Check browser console** for errors
2. **Verify file format** (JPEG, PNG, PDF only)
3. **Check file size** (< 10MB recommended)
4. **Try different document** to isolate issue

### Low Accuracy?

1. **Improve image quality**:
   - Scan at 300 DPI or higher
   - Ensure good lighting
   - Avoid shadows and glare

2. **Enable advanced OCR**:
   - Add DeepSeek or Gemini API key
   - Retry with better OCR engine

3. **Preprocess image**:
   - Increase contrast
   - Convert to grayscale
   - Crop to text area only

### Slow Processing?

1. **Reduce image size** before upload
2. **Use lower resolution** (1500px width is usually enough)
3. **Process fewer pages** at once

## 💡 Pro Tips

### For Best Results

1. **Document Quality**:
   - Use high-resolution scans (300+ DPI)
   - Ensure text is horizontal
   - Good contrast between text and background

2. **File Preparation**:
   - Convert multi-page PDFs to individual pages
   - Crop to relevant area
   - Remove watermarks if possible

3. **Testing Strategy**:
   - Start with clean, simple documents
   - Test with actual invoices/receipts
   - Compare results across different OCR engines
   - Keep sample documents for regression testing

### Optimization

1. **Batch Processing**:
   - Process similar documents together
   - Use consistent file naming
   - Organize by document type

2. **Quality Control**:
   - Always review extracted data
   - Mark low-confidence results for review
   - Build a library of test documents

## 📚 Next Steps

1. ✅ Test basic OCR with sample documents
2. ✅ Configure optional API keys for better accuracy
3. ✅ Test end-to-end document processing flow
4. ✅ Review extracted data in financial records
5. ✅ Generate balance sheets and reports

## 🎯 Success Criteria

You'll know OCR is working correctly when:

- ✅ Documents upload without errors
- ✅ Text is extracted within 5-10 seconds
- ✅ Confidence scores are > 80%
- ✅ Invoice data is correctly parsed
- ✅ Financial records are created automatically
- ✅ No console errors appear

## 📞 Need Help?

- Check `OCR_IMPLEMENTATION.md` for detailed documentation
- Review console logs for error messages
- Test with different document types
- Verify API keys are correctly configured

---

**Happy Testing! 🎉**

The OCR system is production-ready and optimized for maximum accuracy on free tier!
