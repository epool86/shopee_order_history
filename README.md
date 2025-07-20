# Shopee Purchase History Extractor

A professional Chrome browser extension that automatically extracts and exports your complete Shopee purchase history with real-time analytics and CSV export.

## ✨ Features

### 🚀 **One-Click Data Extraction**
- **Automatic Fetching**: Retrieves all your orders with a single button click
- **Smart Authentication**: Automatically extracts login credentials from your active session
- **Unlimited Orders**: Supports accounts with hundreds or thousands of orders
- **Real-time Progress**: Live updates showing current progress and totals

### 📊 **Beautiful Analytics Dashboard**
- **Live Summary Table**: See totals update in real-time as data is fetched
- **Professional Dark Green Theme**: Modern, elegant interface design
- **Order Count**: Total number of orders found
- **Item Count**: Total individual items across all orders
- **Total Spending**: Complete spending amount in RM with proper formatting

### 📋 **Advanced CSV Export**
- **Item-Level Data**: Each row represents one individual item (not order)
- **Complete Context**: Every item includes full order information
- **Comprehensive Columns**: 14 detailed fields including dates, prices, and tracking
- **Excel Ready**: Perfect for spreadsheet analysis and pivot tables

### 🔒 **Smart & Secure**
- **Session-Based**: Uses your existing login session
- **No Hardcoded Credentials**: Dynamically extracts authentication tokens
- **Local Processing**: All data processing happens in your browser
- **Privacy First**: No data sent to external servers

## 🎯 Installation

1. **Download Extension**: Clone or download this repository
2. **Open Chrome Extensions**: Go to `chrome://extensions/`
3. **Enable Developer Mode**: Toggle the switch in the top right
4. **Load Extension**: Click "Load unpacked" and select the extension folder
5. **Ready to Use**: Extension icon appears in your toolbar

## 📖 How to Use

### Step 1: Navigate to Orders
Go to your [Shopee Purchase History](https://shopee.com.my/user/purchase) page

### Step 2: Start Extraction
1. **Look for the Button**: A black "🔄 Fetch Orders" button appears on the right side
2. **Click to Start**: Button changes to "Preparing..." then "Downloading..."
3. **Watch Progress**: Live status updates and real-time analytics table

### Step 3: Review Summary
- **Beautiful Table**: Dark green themed summary with your totals
- **Live Updates**: Numbers update as each batch of orders is processed
- **Final Totals**: Complete count of orders, items, and spending

### Step 4: Download Data
- **CSV Export**: Click "📊 Download CSV File" button
- **Instant Download**: File saves to your downloads folder
- **Spreadsheet Ready**: Open in Excel, Google Sheets, or any CSV viewer

## 📊 CSV Data Structure

Each row in the exported CSV represents **one individual item** with complete order context:

| Column | Description | Example |
|--------|-------------|---------|
| Order ID | Shopee order identifier | 123456789012345 |
| Order Date | Date order was placed | 2024-12-15 |
| Order Status | Current order status | Completed |
| Shop Name | Name of the seller | TechStore Malaysia |
| Shop ID | Unique shop identifier | 987654321 |
| Item Name | Full product name | Wireless Bluetooth Headphones |
| Model/Variant | Product variant | Black, 32GB |
| Quantity | Number of items | 2 |
| Item Price (RM) | Price per unit | 89.90 |
| Item Total (RM) | Total for this item | 179.80 |
| Order Subtotal (RM) | Order subtotal | 179.80 |
| Order Final Total (RM) | Final order amount | 185.80 |
| Item ID | Unique item identifier | 456789012 |
| Tracking Info | Delivery status | Package delivered |

## 🎨 Interface Features

### Professional Design
- **Fixed Width Layout**: Consistent 320px width for clean appearance
- **Borderless Design**: Modern, professional styling without visual clutter
- **Dark Green Theme**: Beautiful gradient table with excellent readability
- **Smooth Animations**: Hover effects and transitions for premium feel

### User-Friendly Messages
- **Clear Progress**: "Connecting to your Shopee account..."
- **Real-time Updates**: "Page 5: Found 3 orders! Total: 23 orders"
- **Success Confirmation**: "Reached the end! Found 47 orders across 10 pages"
- **Error Handling**: "Unable to connect. Please make sure you are logged in"

## 🔧 Technical Specifications

### Architecture
- **Manifest V3**: Latest Chrome extension standard
- **Content Script**: Runs on Shopee purchase history pages
- **Real-time Processing**: Live data extraction and analysis
- **Dynamic Authentication**: Automatic token extraction from page session

### Data Processing
- **Paginated Fetching**: Retrieves 5 orders per request (natural Shopee behavior)
- **Rate Limiting**: 1.5-second delays between requests for respectful usage
- **Error Recovery**: Graceful handling of authentication and network issues
- **Memory Efficient**: Processes large datasets without performance impact

### Compatibility
- **Shopee Malaysia**: Specifically designed for shopee.com.my
- **Chrome Browser**: Optimized for Chrome (Manifest V3)
- **Large Accounts**: Supports up to 1,000 orders (200 pages × 5 orders)
- **All Order Types**: Works with completed, cancelled, and pending orders

## 🛡️ Privacy & Security

### Data Protection
- **Local Only**: All processing happens in your browser
- **No External Servers**: Data never leaves your computer
- **Session Based**: Uses your existing login session
- **Temporary Storage**: No permanent storage of sensitive data

### Authentication
- **Dynamic Token Extraction**: Reads authentication from your active session
- **No Stored Credentials**: Never saves or stores login information
- **Automatic Expiration**: Tokens refresh with each session
- **Secure Communication**: All requests use HTTPS

## 🚨 Troubleshooting

### Common Issues

**❌ "Unable to connect" Error**
- Ensure you're logged into Shopee
- Refresh the purchase history page
- Check your internet connection

**❌ "Access denied" Error**
- Your session may have expired
- Log out and log back into Shopee
- Clear browser cache and try again

**❌ No orders found**
- Make sure you have orders in your purchase history
- Try manually scrolling down to load some orders first
- Check that you're on the correct Shopee domain (.com.my)

**❌ CSV download issues**
- Check your browser's download settings
- Ensure pop-ups are allowed for Shopee
- Try downloading again after a few seconds

### Performance Tips
- **Best Results**: Use on a stable internet connection
- **Large Accounts**: Be patient - 500+ orders may take 10-15 minutes
- **Browser Resources**: Close other tabs for better performance
- **Session Stability**: Don't navigate away during fetching

## 🎯 Use Cases

### Personal Finance
- **Spending Analysis**: Track your Shopee spending patterns
- **Budget Planning**: Understand where your money goes
- **Tax Records**: Maintain purchase records for business expenses
- **Warranty Tracking**: Keep records of purchase dates for warranties

### Business Intelligence
- **Supplier Analysis**: Analyze which shops you buy from most
- **Product Trends**: Track what types of products you purchase
- **Price Monitoring**: Compare prices across different time periods
- **Bulk Analysis**: Use pivot tables for advanced data analysis

### Data Management
- **Backup Records**: Maintain offline backup of your purchase history
- **Cross-Platform**: Use data in Excel, Google Sheets, or databases
- **Integration**: Import into accounting or inventory systems
- **Reporting**: Generate custom reports for personal or business use

## 📝 Changelog

### Version 2.0.0 (Current)
- ✅ Complete UI redesign with professional dark green theme
- ✅ Real-time analytics with live updating summary table
- ✅ CSV export with item-level granularity
- ✅ Automatic authentication token extraction
- ✅ Support for unlimited orders (up to 1,000)
- ✅ Improved error handling and user feedback
- ✅ Borderless, modern interface design
- ✅ Proper date extraction from order timestamps

### Version 1.0.0 (Legacy)
- Basic order extraction functionality
- JSON export format
- Manual header configuration
- Limited to 100 orders

## 🤝 Support

### Getting Help
- **Issues**: Report bugs or request features via GitHub issues
- **Questions**: Check the troubleshooting section first
- **Updates**: Watch the repository for new releases

### Contributing
This is a personal project, but feedback and suggestions are welcome!

---

**⚠️ Disclaimer**: This extension is for personal use only. Please respect Shopee's terms of service and use responsibly. The extension extracts only your own purchase data that you already have access to through Shopee's interface.