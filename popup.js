// Popup script for Shopee Purchase History Extractor

let allPurchases = [];
let filteredPurchases = [];

// DOM elements
const purchaseList = document.getElementById('purchaseList');
const searchBox = document.getElementById('searchBox');
const refreshBtn = document.getElementById('refreshBtn');
const exportBtn = document.getElementById('exportBtn');
const stats = document.getElementById('stats');

// Initialize popup
document.addEventListener('DOMContentLoaded', function() {
  loadPurchaseData();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  searchBox.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', loadPurchaseData);
  exportBtn.addEventListener('click', exportToCSV);
}

// Load purchase data from storage
function loadPurchaseData() {
  chrome.storage.local.get(['shopeePurchases', 'lastUpdated'], function(result) {
    allPurchases = result.shopeePurchases || [];
    filteredPurchases = [...allPurchases];
    
    updateStats(result.lastUpdated);
    renderPurchaseList();
  });
}

// Update statistics display
function updateStats(lastUpdated) {
  const totalItems = allPurchases.length;
  const totalAmount = allPurchases.reduce((sum, item) => sum + parseFloat(item.price), 0);
  const uniqueShops = new Set(allPurchases.map(item => item.shopName)).size;
  
  let statsText = `${totalItems} items • RM ${totalAmount.toFixed(2)} • ${uniqueShops} shops`;
  
  if (lastUpdated) {
    const lastUpdateDate = new Date(lastUpdated).toLocaleDateString();
    statsText += ` • Updated: ${lastUpdateDate}`;
  }
  
  stats.textContent = statsText;
}

// Handle search functionality
function handleSearch() {
  const query = searchBox.value.toLowerCase().trim();
  
  if (!query) {
    filteredPurchases = [...allPurchases];
  } else {
    filteredPurchases = allPurchases.filter(item => 
      item.productName.toLowerCase().includes(query) ||
      item.shopName.toLowerCase().includes(query) ||
      item.productModel.toLowerCase().includes(query)
    );
  }
  
  renderPurchaseList();
}

// Render the purchase list
function renderPurchaseList() {
  if (filteredPurchases.length === 0) {
    if (allPurchases.length === 0) {
      purchaseList.innerHTML = `
        <div class="empty-state">
          <p>No purchase data found</p>
          <p>Visit your Shopee purchase history page and click the "Extract Purchase Data" button</p>
        </div>
      `;
    } else {
      purchaseList.innerHTML = `
        <div class="empty-state">
          <p>No items match your search</p>
        </div>
      `;
    }
    return;
  }
  
  // Sort by order date (newest first)
  filteredPurchases.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
  
  const html = filteredPurchases.map(item => `
    <div class="purchase-item">
      <img src="${item.image}" alt="${item.productName}" class="item-image" 
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yNCAzMkgzNlYzNEgyNFYzMlpNMjQgMjZIMzZWMjhIMjRWMjZaTTI4IDIwSDMyVjI0SDI4VjIwWiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4K'">
      <div class="item-details">
        <div class="item-name">${item.productName}</div>
        <div class="item-shop">${item.shopName}</div>
        <div class="item-meta">
          <span>Qty: ${item.quantity} • ${item.orderDate}</span>
          <span class="item-price">RM ${item.price}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  purchaseList.innerHTML = html;
}

// Export data to CSV
function exportToCSV() {
  if (allPurchases.length === 0) {
    alert('No data to export. Please extract data from Shopee first.');
    return;
  }
  
  // CSV headers
  const headers = [
    'Order ID',
    'Order Date', 
    'Shop Name',
    'Product Name',
    'Model',
    'Quantity',
    'Price (RM)',
    'Original Price (RM)',
    'Status',
    'Delivery Status'
  ];
  
  // Convert data to CSV format
  const csvData = [
    headers.join(','),
    ...allPurchases.map(item => [
      item.orderId,
      item.orderDate,
      `"${item.shopName}"`,
      `"${item.productName}"`,
      `"${item.productModel}"`,
      item.quantity,
      item.price,
      item.originalPrice,
      `"${item.status}"`,
      `"${item.deliveryStatus}"`
    ].join(','))
  ].join('\n');
  
  // Download CSV file
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `shopee_purchases_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}