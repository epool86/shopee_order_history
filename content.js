// Shopee Purchase History Extractor - Content Script

let allOrderData = [];
let isCollecting = false;
let collectedPages = new Set();
let capturedHeaders = null;
let isCapturingHeaders = false;

// Inject interception code into the page context
function injectInterceptionScript() {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('🚀 Injecting network interception into page context...');
      
      // Store collected data in window object for content script access
      window.shopeeCollectedData = window.shopeeCollectedData || [];
      window.shopeeCollectedPages = window.shopeeCollectedPages || new Set();
      
      // Store original methods
      const originalFetch = window.fetch;
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      // Intercept fetch requests
      window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        
        return originalFetch.apply(this, args).then(response => {
          // Check if this is the order API we want
          if (url && url.includes('/api/v4/order/get_all_order_and_checkout_list')) {
            console.log('🎯 Intercepted order API via fetch:', url);
            
            // Clone response to avoid consuming it
            const clonedResponse = response.clone();
            clonedResponse.json().then(data => {
              console.log('📦 Fetch response data:', data);
              
              if (data && data.data?.order_data?.details_list) {
                // Extract offset from URL to track pages
                const offsetMatch = url.match(/offset=(\\d+)/);
                const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
                
                if (!window.shopeeCollectedPages.has(offset)) {
                  window.shopeeCollectedData.push(data);
                  window.shopeeCollectedPages.add(offset);
                  console.log('✅ Stored data for offset', offset, 'Total pages:', window.shopeeCollectedData.length);
                  
                  // Trigger custom event for content script
                  window.dispatchEvent(new CustomEvent('shopeeDataCollected', {
                    detail: { offset, totalPages: window.shopeeCollectedData.length }
                  }));
                }
              }
            }).catch(err => {
              console.log('❌ Failed to parse fetch response:', err);
            });
          }
          
          return response;
        });
      };
      
      // Intercept XMLHttpRequest
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._interceptedUrl = url;
        return originalXHROpen.apply(this, [method, url, ...args]);
      };
      
      XMLHttpRequest.prototype.send = function(...args) {
        const xhr = this;
        
        // Add load event listener
        xhr.addEventListener('load', function() {
          const url = xhr._interceptedUrl;
          if (url && url.includes('/api/v4/order/get_all_order_and_checkout_list')) {
            console.log('🎯 Intercepted order API via XHR:', url);
            
            try {
              const data = JSON.parse(xhr.responseText);
              console.log('📦 XHR response data:', data);
              
              if (data && data.data?.order_data?.details_list) {
                // Extract offset from URL to track pages
                const offsetMatch = url.match(/offset=(\\d+)/);
                const offset = offsetMatch ? parseInt(offsetMatch[1]) : 0;
                
                if (!window.shopeeCollectedPages.has(offset)) {
                  window.shopeeCollectedData.push(data);
                  window.shopeeCollectedPages.add(offset);
                  console.log('✅ Stored XHR data for offset', offset, 'Total pages:', window.shopeeCollectedData.length);
                  
                  // Trigger custom event for content script
                  window.dispatchEvent(new CustomEvent('shopeeDataCollected', {
                    detail: { offset, totalPages: window.shopeeCollectedData.length }
                  }));
                }
              }
            } catch (err) {
              console.log('❌ Failed to parse XHR response:', err);
            }
          }
        });
        
        return originalXHRSend.apply(this, args);
      };
      
      console.log('✅ Network interception setup complete in page context');
    })();
  `;
  
  // Inject at the very beginning of the document
  (document.head || document.documentElement).appendChild(script);
  script.remove();
  
  console.log('🎯 Injected interception script into page');
}

// Listen for data collection events from injected script
window.addEventListener('shopeeDataCollected', (event) => {
  const { offset, totalPages } = event.detail;
  console.log(`🎉 Content script received data collection event: offset ${offset}, total pages: ${totalPages}`);
  
  // Update our tracking
  allOrderData = window.shopeeCollectedData || [];
  collectedPages = window.shopeeCollectedPages || new Set();
  
  console.log(`📊 Current collection status: ${allOrderData.length} pages collected`);
});

// Function to download JSON data (kept for compatibility)
function downloadJSON(data, filename) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('Downloaded JSON file:', filename);
  } catch (err) {
    console.error('Failed to download JSON:', err);
  }
}

// Function to convert data to CSV format (each row = one item)
function convertToCSV(data) {
  const csvRows = [];
  
  // CSV Headers
  const headers = [
    'Order ID',
    'Order Date',
    'Order Status',
    'Shop Name',
    'Shop ID',
    'Item Name',
    'Model/Variant',
    'Quantity',
    'Item Price (RM)',
    'Item Total (RM)',
    'Order Subtotal (RM)',
    'Order Final Total (RM)',
    'Item ID',
    'Tracking Info'
  ];
  csvRows.push(headers.join(','));
  
  // Process each page of data
  data.all_data.forEach(pageData => {
    if (pageData.data?.order_data?.details_list) {
      const orders = pageData.data.order_data.details_list;
      
      orders.forEach(order => {
        // Extract order-level information
        const orderId = order.info_card?.order_id || 'N/A';
        const orderStatus = order.status?.list_view_status_label?.text || 'N/A';
        const orderSubtotal = order.info_card?.subtotal ? (order.info_card.subtotal / 100000).toFixed(2) : '0.00';
        const orderFinalTotal = order.info_card?.final_total ? (order.info_card.final_total / 100000).toFixed(2) : '0.00';
        const trackingInfo = order.shipping?.tracking_info?.description || 'N/A';
        
        // Extract date from order ID or shipping info
        let orderDate = 'N/A';
        
        // Method 1: Try to extract from shipping tracking info timestamp
        if (order.shipping?.tracking_info?.ctime) {
          const timestamp = order.shipping.tracking_info.ctime * 1000; // Convert to milliseconds
          orderDate = new Date(timestamp).toISOString().split('T')[0];
        }
        // Method 2: Try to parse Shopee order ID (contains timestamp in first digits)
        else if (orderId && orderId !== 'N/A' && String(orderId).length >= 15) {
          try {
            // Shopee order IDs typically start with timestamp-like numbers
            // Take first 10-13 digits and try to parse as timestamp
            const orderIdStr = String(orderId);
            const timestampPart = orderIdStr.substring(0, 10); // First 10 digits
            const timestamp = parseInt(timestampPart) * 1000; // Convert to milliseconds
            
            // Validate if this gives us a reasonable date (between 2015-2030)
            const date = new Date(timestamp);
            const year = date.getFullYear();
            if (year >= 2015 && year <= 2030) {
              orderDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            // If parsing fails, try shorter timestamp
            try {
              const orderIdStr = String(orderId);
              const timestampPart = orderIdStr.substring(0, 13); // First 13 digits (milliseconds)
              const timestamp = parseInt(timestampPart);
              
              const date = new Date(timestamp);
              const year = date.getFullYear();
              if (year >= 2015 && year <= 2030) {
                orderDate = date.toISOString().split('T')[0];
              }
            } catch (e2) {
              // Keep as 'N/A' if all parsing fails
            }
          }
        }
        
        // Process items in this order
        if (order.info_card?.order_list_cards && Array.isArray(order.info_card.order_list_cards)) {
          order.info_card.order_list_cards.forEach(card => {
            const shopName = card.shop_info?.shop_name || 'N/A';
            const shopId = card.shop_info?.shop_id || 'N/A';
            
            if (card.product_info?.item_groups && Array.isArray(card.product_info.item_groups)) {
              card.product_info.item_groups.forEach(group => {
                if (group.items && Array.isArray(group.items)) {
                  group.items.forEach(item => {
                    // Extract item information
                    const itemName = item.name || 'N/A';
                    const modelName = item.model_name || 'N/A';
                    const quantity = item.amount || 1;
                    const itemPrice = item.item_price ? (item.item_price / 100000).toFixed(2) : '0.00';
                    const itemTotal = item.order_price ? (item.order_price / 100000).toFixed(2) : '0.00';
                    const itemId = item.item_id || 'N/A';
                    
                    // Escape CSV values (handle commas and quotes)
                    const escapeCSV = (value) => {
                      if (typeof value !== 'string') value = String(value);
                      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return '"' + value.replace(/"/g, '""') + '"';
                      }
                      return value;
                    };
                    
                    // Create CSV row for this item
                    const row = [
                      escapeCSV(orderId),
                      escapeCSV(orderDate),
                      escapeCSV(orderStatus),
                      escapeCSV(shopName),
                      escapeCSV(shopId),
                      escapeCSV(itemName),
                      escapeCSV(modelName),
                      quantity,
                      itemPrice,
                      itemTotal,
                      orderSubtotal,
                      orderFinalTotal,
                      escapeCSV(itemId),
                      escapeCSV(trackingInfo)
                    ];
                    
                    csvRows.push(row.join(','));
                  });
                }
              });
            }
          });
        }
      });
    }
  });
  
  return csvRows.join('\n');
}

// Function to download CSV data
function downloadCSV(data, filename) {
  try {
    const csvContent = convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('Downloaded CSV file:', filename);
  } catch (err) {
    console.error('Failed to download CSV:', err);
  }
}

// Function to download text data
function downloadText(text, filename) {
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('Downloaded text file:', filename);
  } catch (err) {
    console.error('Failed to download text:', err);
  }
}

// Function to trigger data collection by scrolling (natural behavior)
async function collectAllOrderData() {
  if (isCollecting) {
    console.log('Already collecting data...');
    return;
  }
  
  isCollecting = true;
  allOrderData = [];
  collectedPages.clear();
  
  console.log('Starting natural data collection by slow scrolling...');
  
  let scrollAttempts = 0;
  const maxScrollAttempts = 100; // More attempts since we're going slower
  let noNewDataCounter = 0;
  const maxNoNewDataAttempts = 8; // More patient with slower loading
  
  try {
    while (scrollAttempts < maxScrollAttempts && noNewDataCounter < maxNoNewDataAttempts) {
      const currentDataCount = allOrderData.length;
      
      // Slow, natural scrolling behavior
      const currentScroll = window.pageYOffset;
      const documentHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      
      // Scroll gradually, not all the way to bottom at once
      const scrollStep = viewportHeight * 0.7; // Scroll about 70% of viewport
      const targetScroll = Math.min(currentScroll + scrollStep, documentHeight - viewportHeight);
      
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
      
      console.log(`Natural scroll attempt ${scrollAttempts + 1}, scrolled to ${targetScroll}, pages collected: ${allOrderData.length}`);
      
      // Longer wait to mimic natural reading/browsing behavior
      const waitTime = 3000 + Math.random() * 2000; // 3-5 seconds
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check if we got new data
      if (allOrderData.length === currentDataCount) {
        noNewDataCounter++;
        console.log(`No new data on attempt ${scrollAttempts + 1}, no-new-data counter: ${noNewDataCounter}`);
        
        // If no new data, try a small scroll back up and then down (natural user behavior)
        if (noNewDataCounter % 2 === 0) {
          window.scrollTo({
            top: Math.max(0, currentScroll - 200),
            behavior: 'smooth'
          });
          await new Promise(resolve => setTimeout(resolve, 1500));
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } else {
        noNewDataCounter = 0; // Reset counter if we got new data
        console.log(`Got new data! Total pages now: ${allOrderData.length}`);
      }
      
      scrollAttempts++;
      
      // Occasionally scroll to very bottom to trigger end-of-list loading
      if (scrollAttempts % 10 === 0) {
        console.log('Checking if we can load more by scrolling to very bottom...');
        window.scrollTo({
          top: documentHeight,
          behavior: 'smooth'
        });
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
    
    // Download all collected data
    if (allOrderData.length > 0) {
      const combinedData = {
        total_pages: allOrderData.length,
        collected_at: new Date().toISOString(),
        collection_method: 'natural_scrolling',
        all_data: allOrderData
      };
      
      downloadJSON(combinedData, `shopee_all_orders_${Date.now()}.json`);
      console.log(`Successfully collected ${allOrderData.length} pages of order data via natural scrolling`);
    } else {
      console.log('No order data was collected. The page might not be loading data yet, or you might need to be logged in.');
    }
    
  } catch (error) {
    console.error('Error during data collection:', error);
  } finally {
    isCollecting = false;
  }
}


// Initialize the content script
function init() {
  console.log('Shopee Purchase History Extractor loaded');
  console.log('Current URL:', window.location.href);
  console.log('Page title:', document.title);
  
  // Skip script injection due to CSP, use direct approach instead
  console.log('🔧 Using direct fetch approach (CSP prevents script injection)');
  
  // Add the fetch button
  addFetchButton();
}

// Function to start monitoring for API calls without scrolling
function startMonitoring() {
  if (isCollecting) {
    console.log('Already collecting data...');
    return;
  }
  
  isCollecting = true;
  
  // Clear previous data from window object
  if (window.shopeeCollectedData) {
    window.shopeeCollectedData.length = 0;
  }
  if (window.shopeeCollectedPages) {
    window.shopeeCollectedPages.clear();
  }
  
  allOrderData = [];
  collectedPages.clear();
  
  console.log('🔍 Started monitoring for API calls. Scroll manually to load more data.');
  console.log('📋 The extension will automatically capture API responses from the page context.');
  
  // Set a timeout to stop monitoring and download data
  setTimeout(() => {
    if (isCollecting) {
      isCollecting = false;
      
      // Get data from window object (injected script)
      const collectedData = window.shopeeCollectedData || [];
      
      if (collectedData.length > 0) {
        const combinedData = {
          total_pages: collectedData.length,
          collected_at: new Date().toISOString(),
          collection_method: 'manual_monitoring',
          all_data: collectedData
        };
        
        downloadJSON(combinedData, `shopee_all_orders_${Date.now()}.json`);
        console.log(`✅ Monitoring complete! Downloaded ${collectedData.length} pages of data.`);
      } else {
        console.log('⚠️ No data collected during monitoring period.');
        console.log('💡 Try refreshing the page and starting monitor mode before scrolling.');
      }
    }
  }, 60000); // Monitor for 60 seconds
}

// Function to manually stop monitoring and download data
function stopMonitoringAndDownload() {
  if (!isCollecting) {
    console.log('Not currently monitoring...');
    return false;
  }
  
  isCollecting = false;
  
  // Get data from window object (injected script)
  const collectedData = window.shopeeCollectedData || [];
  
  if (collectedData.length > 0) {
    const combinedData = {
      total_pages: collectedData.length,
      collected_at: new Date().toISOString(),
      collection_method: 'manual_monitoring_stopped',
      all_data: collectedData
    };
    
    downloadJSON(combinedData, `shopee_all_orders_${Date.now()}.json`);
    console.log(`✅ Downloaded ${collectedData.length} pages of data.`);
    return true;
  } else {
    console.log('⚠️ No data collected yet.');
    console.log('💡 Try scrolling through the purchase history to load more data.');
    return false;
  }
}

// Debug function to check what's happening
function debugInfo() {
  console.log('🔧 DEBUG INFO:');
  console.log('- Current URL:', window.location.href);
  console.log('- window.fetch exists:', !!window.fetch);
  console.log('- window.shopeeCollectedData:', window.shopeeCollectedData);
  console.log('- window.shopeeCollectedPages:', window.shopeeCollectedPages);
  console.log('- isCollecting:', isCollecting);
  console.log('- allOrderData length:', allOrderData.length);
  
  // Check if we can access cookies
  console.log('- document.cookie length:', document.cookie.length);
  
  // Try to find any existing order data on the page
  const scripts = document.querySelectorAll('script');
  let foundOrderData = false;
  scripts.forEach((script, index) => {
    if (script.textContent.includes('order_data') || script.textContent.includes('details_list')) {
      console.log(`- Found order_data in script ${index}:`, script.textContent.substring(0, 200) + '...');
      foundOrderData = true;
    }
  });
  
  if (!foundOrderData) {
    console.log('- No order_data found in page scripts');
  }
  
  // Test a simple fetch to see what happens
  console.log('- Testing simple API call...');
  fetch('/api/v4/order/get_all_order_and_checkout_list?limit=5&offset=0')
    .then(response => {
      console.log('- Test API response status:', response.status);
      return response.text();
    })
    .then(text => {
      console.log('- Test API response text (first 200 chars):', text.substring(0, 200));
    })
    .catch(err => {
      console.log('- Test API error:', err.message);
    });
}

// Auto-capture headers from a real API call using Network API monitoring
async function captureHeadersFromRealRequest() {
  if (isCapturingHeaders) {
    console.log('Already capturing headers...');
    return capturedHeaders;
  }
  
  if (capturedHeaders && capturedHeaders['af-ac-enc-dat']) {
    console.log('✅ Using previously captured complete headers');
    return capturedHeaders;
  }
  
  console.log('🎯 Capturing headers from real API call...');
  isCapturingHeaders = true;
  
  return new Promise((resolve) => {
    // Method 1: Try to intercept via XMLHttpRequest override (more reliable)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    let requestCaptured = false;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._captureUrl = url;
      this._captureMethod = method;
      return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
      const xhr = this;
      
      // Capture request headers before sending
      if (!requestCaptured && xhr._captureUrl && xhr._captureUrl.includes('/api/v4/order/get_all_order_and_checkout_list')) {
        console.log('🎯 Intercepting XHR request:', xhr._captureUrl);
        
        // Try to extract headers from the XHR object
        const capturedRequestHeaders = {};
        
        // Unfortunately, we can't easily get request headers from XHR after they're set
        // So we'll monitor the response and extract what we can from cookies/page
        
        xhr.addEventListener('load', function() {
          if (!requestCaptured) {
            console.log('📋 XHR completed, extracting available headers...');
            
            // Get what we can from the current page state
            const pageHeaders = extractAllAvailableHeaders();
            
            if (Object.keys(pageHeaders).length > 0) {
              capturedHeaders = pageHeaders;
              requestCaptured = true;
              isCapturingHeaders = false;
              
              console.log('✅ Captured headers from XHR completion');
              
              // Restore original XHR
              XMLHttpRequest.prototype.open = originalXHROpen;
              XMLHttpRequest.prototype.send = originalXHRSend;
              
              resolve(capturedHeaders);
            }
          }
        });
      }
      
      return originalXHRSend.apply(this, arguments);
    };
    
    // Method 2: More aggressive scrolling to trigger API calls
    console.log('📜 Triggering multiple scrolls to generate API call...');
    
    let scrollAttempts = 0;
    const maxScrollAttempts = 3;
    
    const triggerScrolls = async () => {
      for (let i = 0; i < maxScrollAttempts; i++) {
        const currentScroll = window.pageYOffset;
        const targetScroll = currentScroll + window.innerHeight * (i + 1);
        
        console.log(`📜 Scroll attempt ${i + 1}/${maxScrollAttempts}`);
        window.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
        
        // Wait between scrolls
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (requestCaptured) break;
      }
      
      // Try going to very bottom
      if (!requestCaptured) {
        console.log('📜 Final attempt: scrolling to very bottom');
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    };
    
    // Start scrolling
    triggerScrolls().then(() => {
      // Final timeout
      setTimeout(() => {
        if (!requestCaptured) {
          console.log('⚠️ No API call captured after all attempts. Trying page extraction...');
          
          // Restore XHR
          XMLHttpRequest.prototype.open = originalXHROpen;
          XMLHttpRequest.prototype.send = originalXHRSend;
          isCapturingHeaders = false;
          
          // Try comprehensive page extraction
          const fallbackHeaders = extractAllAvailableHeaders();
          if (Object.keys(fallbackHeaders).length > 0) {
            capturedHeaders = fallbackHeaders;
            console.log('✅ Used page extraction');
            resolve(capturedHeaders);
          } else {
            console.log('❌ Could not capture any headers');
            resolve(null);
          }
        }
      }, 2000);
    });
  });
}

// Comprehensive header extraction from all available sources
function extractAllAvailableHeaders() {
  console.log('🔍 Comprehensive: Extracting all available headers...');
  
  const headers = {};
  
  // 1. Get CSRF token from cookie
  const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
  if (csrfMatch) {
    headers['x-csrftoken'] = csrfMatch[1];
    console.log('✅ Found CSRF token');
  }
  
  // 2. Look for Shopee tokens in cookies
  const cookieTokens = {
    'shopee_webUnique_ccd': /shopee_webUnique_ccd=([^;]+)/,
    'ds': /ds=([^;]+)/,
    'SPC_EC': /SPC_EC=([^;]+)/,
    'SPC_ST': /SPC_ST=([^;]+)/
  };
  
  Object.entries(cookieTokens).forEach(([name, pattern]) => {
    const match = document.cookie.match(pattern);
    if (match) {
      console.log(`✅ Found cookie ${name}`);
      // Don't store cookies as headers, but log them for debugging
    }
  });
  
  // 3. Extract from shopee_webUnique_ccd cookie for af-ac-enc tokens
  const uniqueCcdMatch = document.cookie.match(/shopee_webUnique_ccd=([^;]+)/);
  if (uniqueCcdMatch) {
    try {
      const decoded = decodeURIComponent(uniqueCcdMatch[1]);
      const parts = decoded.split('|');
      if (parts.length >= 2) {
        headers['af-ac-enc-sz-token'] = decoded; // Use full token
        console.log('✅ Extracted af-ac-enc-sz-token from cookie');
        
        // Try to extract af-ac-enc-dat (usually first part before |)
        if (parts[0]) {
          // af-ac-enc-dat is often derived from the first part
          headers['af-ac-enc-dat'] = parts[0].split('=')[0] || parts[0];
          console.log('✅ Derived af-ac-enc-dat from cookie');
        }
      }
    } catch (e) {
      console.log('⚠️ Could not parse shopee_webUnique_ccd');
    }
  }
  
  // 4. Look for tokens in page scripts (more aggressive search)
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent;
    
    // Look for various token patterns in scripts
    const tokenPatterns = [
      { name: 'x-sap-ri', pattern: /["']x-sap-ri["']\s*:\s*["']([^"']+)["']/i },
      { name: 'x-sap-sec', pattern: /["']x-sap-sec["']\s*:\s*["']([^"']+)["']/i },
      { name: 'af-ac-enc-dat', pattern: /["']af-ac-enc-dat["']\s*:\s*["']([^"']+)["']/i },
      { name: 'af-ac-enc-sz-token', pattern: /["']af-ac-enc-sz-token["']\s*:\s*["']([^"']+)["']/i },
      { name: 'x-sz-sdk-version', pattern: /["']x-sz-sdk-version["']\s*:\s*["']([^"']+)["']/i }
    ];
    
    tokenPatterns.forEach(({ name, pattern }) => {
      if (!headers[name]) { // Only if not already found
        const match = content.match(pattern);
        if (match && match[1]) {
          headers[name] = match[1];
          console.log(`✅ Found ${name} in script`);
        }
      }
    });
    
    // Stop after finding some tokens to avoid processing too many scripts
    if (Object.keys(headers).length > 5) break;
  }
  
  // 5. Look in window object for any exposed tokens
  const windowTokens = [
    'shopee_webUnique_ccd',
    'csrftoken', 
    'securityToken',
    'apiToken'
  ];
  
  windowTokens.forEach(tokenName => {
    try {
      if (window[tokenName]) {
        console.log(`✅ Found window.${tokenName}`);
        // Don't overwrite existing headers
      }
    } catch (e) {
      // Ignore errors
    }
  });
  
  console.log(`🔍 Extracted ${Object.keys(headers).length} headers:`, Object.keys(headers));
  return headers;
}

// Fallback: Extract what we can from page (simplified version)
function extractHeadersFromPageFallback() {
  return extractAllAvailableHeaders();
}



// Simple approach: Use same-origin fetch with all cookies
async function directFetchWithAuth() {
  console.log('🚀 Starting authenticated fetch...');
  
  // Function to update progress (will be available when called from button click)
  const updateProgress = window.updateShopeeProgress || (() => {});
  
  // Get all cookies as string
  const cookies = document.cookie;
  console.log('Using cookies:', cookies.substring(0, 100) + '...');
  
  const allData = [];
  let offset = 0;
  const limit = 5;
  let totalOrdersFound = 0;
  
  // Extract required headers from page
  function extractHeadersFromPage() {
    const headers = {};
    
    // Get CSRF token from cookie
    const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
    if (csrfMatch) {
      headers['x-csrftoken'] = csrfMatch[1];
    }
    
    // Try to find other tokens in page scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;
      
      // Look for common Shopee tokens
      const patterns = [
        /af-ac-enc-dat["']\s*:\s*["']([^"']+)["']/i,
        /af-ac-enc-sz-token["']\s*:\s*["']([^"']+)["']/i,
        /x-sap-ri["']\s*:\s*["']([^"']+)["']/i,
        /x-sap-sec["']\s*:\s*["']([^"']+)["']/i
      ];
      
      patterns.forEach(pattern => {
        const match = content.match(pattern);
        if (match) {
          const key = pattern.source.split('[')[0].toLowerCase();
          headers[key] = match[1];
        }
      });
    }
    
    return headers;
  }
  
  const extractedHeaders = extractHeadersFromPage();
  console.log('🔍 Extracted headers from page:', extractedHeaders);
  
  // Headers that mimic a real browser request
  const baseHeaders = {
    'accept': 'application/json',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'x-requested-with': 'XMLHttpRequest',
    'x-api-source': 'pc',
    'x-shopee-language': 'en',
    'referer': window.location.href,
    'user-agent': navigator.userAgent
  };
  
  // Try to use captured headers first
  let finalHeaders = baseHeaders;
  
  if (capturedHeaders && Object.keys(capturedHeaders).length > 0) {
    console.log('✅ Using captured headers from real request');
    finalHeaders = { ...baseHeaders, ...capturedHeaders };
  } else {
    // Fallback to extracted headers
    finalHeaders = { ...baseHeaders, ...extractedHeaders };
  }
  
  console.log('🔑 Final headers count:', Object.keys(finalHeaders).length);
  console.log('🔍 Key headers present:', {
    'x-csrftoken': !!finalHeaders['x-csrftoken'],
    'af-ac-enc-dat': !!finalHeaders['af-ac-enc-dat'],
    'x-sap-ri': !!finalHeaders['x-sap-ri'],
    'x-sap-sec': !!finalHeaders['x-sap-sec']
  });
  
  const headers = finalHeaders;
  
  try {
    const maxPages = 200; // Increased limit: 200 pages × 5 orders = 1000 orders max
    for (let i = 0; i < maxPages; i++) {
      const url = `/api/v4/order/get_all_order_and_checkout_list?limit=${limit}&offset=${offset}`;
      console.log(`Fetching: ${url}`);
      
      updateProgress(`📋 Looking for orders (page ${i + 1})...`, 'info');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include',
        referrer: window.location.href,
        referrerPolicy: 'strict-origin-when-cross-origin'
      });
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Error ${response.status}:`, errorText);
        
        if (response.status === 403) {
          updateProgress('🔐 Access denied. Please make sure you are logged in to Shopee.', 'error');
          console.log('🔑 Authentication issue. You might need to:');
          console.log('1. Make sure you are logged in to Shopee');
          console.log('2. Try scrolling manually first to trigger a real request');
          console.log('3. Check if you have any ad blockers interfering');
        } else {
          updateProgress('❌ Unable to connect to Shopee. Please try again.', 'error');
        }
        break;
      }
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.data?.order_data?.details_list) {
        const orders = data.data.order_data.details_list;
        if (orders.length === 0) {
          updateProgress(`✅ Reached the end! Found ${totalOrdersFound} orders across ${allData.length} pages.`, 'success');
          console.log('No more orders, stopping...');
          break;
        }
        
        // Count actual orders in this batch
        const ordersInThisBatch = orders.length;
        totalOrdersFound += ordersInThisBatch;
        
        allData.push(data);
        offset += limit;
        updateProgress(`✅ Page ${i + 1}: Found ${ordersInThisBatch} orders! Total: ${totalOrdersFound} orders`, 'success');
        console.log(`✅ Added page ${i + 1}, total pages: ${allData.length}`);
        
        // Update summary table with live data
        if (window.updateShopeeProgress && window.liveUpdateSummary) {
          window.liveUpdateSummary(allData, true);
        }
      } else {
        updateProgress('⚠️ No orders found in this batch. Finished downloading.', 'warning');
        console.log('No order data in response, stopping...');
        break;
      }
      
      // Small delay to be respectful
      if (i < 19) { // Don't delay on last iteration
        updateProgress(`⏳ Taking a short break (${totalOrdersFound} orders found so far)...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    if (allData.length > 0) {
      updateProgress(`📊 Analyzing ${totalOrdersFound} orders...`, 'info');
      
      const combinedData = {
        total_pages: allData.length,
        total_orders: totalOrdersFound,
        collected_at: new Date().toISOString(),
        collection_method: 'authenticated_fetch',
        all_data: allData
      };
      
      updateProgress(`✅ Found ${totalOrdersFound} orders across ${allData.length} pages.`, 'success');
      console.log(`✅ Success! Collected ${allData.length} pages of order data.`);
      return { success: true, data: combinedData, allData: allData };
    } else {
      updateProgress('❌ No orders found. Please make sure you are logged in to Shopee.', 'error');
      console.log('❌ No data collected.');
      return { success: false, data: null, allData: [] };
    }
    
  } catch (error) {
    console.error('❌ Fetch error:', error);
    updateProgress(`❌ Error: ${error.message}`, 'error');
    return { success: false, data: null, allData: [] };
  }
}

// Add single action button
function addFetchButton() {
  const container = document.createElement('div');
  container.id = 'shopee-extension-container'; // Add ID for detection
  container.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 10000;
    width: 320px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  // Single action button - black design
  const actionButton = document.createElement('button');
  actionButton.textContent = 'Fetch Orders';
  actionButton.style.cssText = `
    background: #2c2c2c;
    color: white;
    border: none;
    padding: 14px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    font-family: inherit;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    white-space: nowrap;
    width: 100%;
    margin-bottom: 8px;
  `;
  
  // Progress status div
  const progressDiv = document.createElement('div');
  progressDiv.style.cssText = `
    background: rgba(44, 44, 44, 0.95);
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    border: none;
    width: 100%;
    box-sizing: border-box;
    display: none;
    line-height: 1.4;
    margin-bottom: 8px;
  `;
  progressDiv.id = 'shopee-progress-status';
  
  // Summary table container - Dark Green Theme
  const summaryContainer = document.createElement('div');
  summaryContainer.style.cssText = `
    background: linear-gradient(135deg, #1a2f1a 0%, #0f1f0f 100%);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
    border: none;
    overflow: hidden;
    display: none;
    margin-bottom: 8px;
  `;
  summaryContainer.id = 'shopee-summary';
  
  // Summary table
  const summaryTable = document.createElement('table');
  summaryTable.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-family: inherit;
  `;
  
  // Table header
  const tableHeader = document.createElement('thead');
  tableHeader.innerHTML = `
    <tr style="background: linear-gradient(135deg, #2d5a2d 0%, #1a4a1a 100%);">
      <th style="padding: 12px; text-align: left; font-weight: 600; color: #e8f5e8;">Summary</th>
      <th style="padding: 12px; text-align: right; font-weight: 600; color: #e8f5e8;">Count</th>
    </tr>
  `;
  
  // Table body
  const tableBody = document.createElement('tbody');
  tableBody.innerHTML = `
    <tr style="background: rgba(255,255,255,0.03);">
      <td style="padding: 10px 12px; color: #b8d4b8;">📦 Total Orders</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #e8f5e8;" id="total-orders">-</td>
    </tr>
    <tr style="background: rgba(255,255,255,0.05);">
      <td style="padding: 10px 12px; color: #b8d4b8;">📋 Total Items</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: 500; color: #e8f5e8;" id="total-items">-</td>
    </tr>
    <tr style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); position: relative;">
      <td style="padding: 10px 12px; color: white; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">💰 Total Amount</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: white; font-size: 14px; text-shadow: 0 1px 2px rgba(0,0,0,0.3);" id="total-amount">RM 0.00</td>
    </tr>
  `;
  
  summaryTable.appendChild(tableHeader);
  summaryTable.appendChild(tableBody);
  summaryContainer.appendChild(summaryTable);
  
  // Download button
  const downloadButton = document.createElement('button');
  downloadButton.textContent = '📊 Download CSV File';
  downloadButton.style.cssText = `
    background: #059669;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    width: 100%;
    transition: all 0.2s ease;
    display: none;
  `;
  downloadButton.id = 'shopee-download-btn';
  
  // Hover effects
  actionButton.addEventListener('mouseenter', () => {
    if (!actionButton.disabled) {
      actionButton.style.background = '#3c3c3c';
      actionButton.style.transform = 'translateY(-1px)';
      actionButton.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
    }
  });
  
  actionButton.addEventListener('mouseleave', () => {
    if (!actionButton.disabled) {
      actionButton.style.background = '#2c2c2c';
      actionButton.style.transform = 'translateY(0)';
      actionButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    }
  });
  
  downloadButton.addEventListener('mouseenter', () => {
    downloadButton.style.background = '#047857';
    downloadButton.style.transform = 'translateY(-1px)';
  });
  
  downloadButton.addEventListener('mouseleave', () => {
    downloadButton.style.background = '#059669';
    downloadButton.style.transform = 'translateY(0)';
  });
  
  // Store collected data for download
  let collectedOrderData = null;
  
  // Download button click handler
  downloadButton.onclick = () => {
    if (collectedOrderData) {
      downloadCSV(collectedOrderData, `shopee_orders_${Date.now()}.csv`);
      updateProgress('🎯 CSV file downloaded to your downloads folder!', 'success');
    }
  };
  
  // Function to calculate and update summary (with live updates)
  function updateSummary(allData, isLiveUpdate = false) {
    let totalOrders = 0;
    let totalItems = 0;
    let totalAmount = 0;
    
    allData.forEach(pageData => {
      if (pageData.data?.order_data?.details_list) {
        const orders = pageData.data.order_data.details_list;
        totalOrders += orders.length;
        
        orders.forEach(order => {
          // Count items - correct structure: order.info_card.order_list_cards[].product_info.item_groups[].items[]
          if (order.info_card?.order_list_cards && Array.isArray(order.info_card.order_list_cards)) {
            order.info_card.order_list_cards.forEach(card => {
              if (card.product_info?.item_groups && Array.isArray(card.product_info.item_groups)) {
                card.product_info.item_groups.forEach(group => {
                  if (group.items && Array.isArray(group.items)) {
                    group.items.forEach(item => {
                      totalItems += item.amount || 1;
                    });
                  }
                });
              }
            });
          }
          
          // Add order total amount - final_total is under info_card
          if (order.info_card?.final_total) {
            totalAmount += order.info_card.final_total;
          }
        });
      }
    });
    
    // Update UI
    document.getElementById('total-orders').textContent = totalOrders.toLocaleString();
    document.getElementById('total-items').textContent = totalItems.toLocaleString();
    document.getElementById('total-amount').textContent = `RM ${(totalAmount / 100000).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    // Show summary table immediately when called
    summaryContainer.style.display = 'block';
    
    // Only show download button when complete
    if (!isLiveUpdate) {
      downloadButton.style.display = 'block';
    }
  }
  
  // Combined action: capture headers + fetch data
  actionButton.onclick = async () => {
    if (actionButton.disabled) return;
    
    actionButton.disabled = true;
    actionButton.style.background = '#1a1a1a';
    actionButton.style.cursor = 'not-allowed';
    
    try {
      // Step 1: Capture headers
      actionButton.textContent = 'Preparing...';
      updateProgress('🔧 Preparing to connect to Shopee...', 'info');
      
      let headers = null;
      if (!capturedHeaders || !capturedHeaders['af-ac-enc-dat']) {
        updateProgress('🌐 Connecting to your Shopee account...', 'info');
        headers = await captureHeadersFromRealRequest();
        
        if (!headers || Object.keys(headers).length === 0) {
          updateProgress('❌ Unable to connect. Please make sure you are logged in to Shopee.', 'error');
          console.log('❌ Could not capture headers');
          return;
        } else {
          updateProgress('✅ Connected successfully!', 'success');
        }
      } else {
        updateProgress('✅ Already connected to your account', 'success');
      }
      
      // Step 2: Fetch data
      actionButton.textContent = 'Downloading...';
      updateProgress('📦 Starting to download your orders...', 'info');
      
      // Show empty summary table immediately
      summaryContainer.style.display = 'block';
      
      const fetchResult = await directFetchWithAuth();
      
      // Step 3: Show result
      if (fetchResult.success) {
        actionButton.textContent = '✓ Complete!';
        actionButton.style.background = '#22c55e';
        updateProgress('🎉 Analysis complete! Check your summary below.', 'success');
        
        // Store data and update summary
        collectedOrderData = fetchResult.data;
        updateSummary(fetchResult.allData);
      } else {
        actionButton.textContent = '✗ Failed';
        actionButton.style.background = '#ef4444';
        updateProgress('❌ Something went wrong. Please make sure you are logged in to Shopee.', 'error');
      }
      
    } catch (error) {
      console.error('Error:', error);
      actionButton.textContent = '✗ Error';
      actionButton.style.background = '#ef4444';
      updateProgress('❌ Something went wrong. Please try again or refresh the page.', 'error');
    }
    
    // Reset button after 5 seconds and hide progress
    setTimeout(() => {
      actionButton.textContent = 'Fetch Orders';
      actionButton.style.background = '#2c2c2c';
      actionButton.style.cursor = 'pointer';
      actionButton.disabled = false;
      hideProgress();
    }, 5000);
  };
  
  // Helper function to update progress status
  function updateProgress(message, type = 'info') {
    progressDiv.style.display = 'block';
    progressDiv.innerHTML = message;
    
    // Color coding based on type
    switch(type) {
      case 'success':
        progressDiv.style.borderLeft = '4px solid #22c55e';
        break;
      case 'error':
        progressDiv.style.borderLeft = '4px solid #ef4444';
        break;
      case 'warning':
        progressDiv.style.borderLeft = '4px solid #f59e0b';
        break;
      default:
        progressDiv.style.borderLeft = '4px solid #3b82f6';
    }
  }
  
  // Helper function to hide progress
  function hideProgress() {
    progressDiv.style.display = 'none';
  }
  
  // Make functions globally available
  window.updateShopeeProgress = updateProgress;
  window.liveUpdateSummary = updateSummary;

  container.appendChild(actionButton);
  container.appendChild(progressDiv);
  container.appendChild(summaryContainer);
  container.appendChild(downloadButton);
  document.body.appendChild(container);
}

// Skip script injection due to CSP restrictions
console.log('🔧 Content script loaded, using direct fetch approach');

// Function to check if we're on the purchase history page
function isPurchaseHistoryPage() {
  return window.location.href.includes('/user/purchase');
}

// Function to initialize or remove extension based on current page
function handlePageChange() {
  if (isPurchaseHistoryPage()) {
    // Check if extension is already initialized
    if (!document.getElementById('shopee-extension-container')) {
      console.log('🔄 Purchase history page detected, initializing extension...');
      init();
    }
  } else {
    // Remove extension UI if we're not on purchase page
    const container = document.getElementById('shopee-extension-container');
    if (container) {
      console.log('🚫 Left purchase page, removing extension UI...');
      container.remove();
    }
  }
}

// Add container ID to make it detectable
function init() {
  console.log('Shopee Purchase History Extractor loaded');
  console.log('Current URL:', window.location.href);
  console.log('Page title:', document.title);
  
  // Skip script injection due to CSP, use direct approach instead
  console.log('🔧 Using direct fetch approach (CSP prevents script injection)');
  
  // Add the fetch button
  addFetchButton();
}

// More aggressive URL monitoring for SPAs
let currentUrl = window.location.href;
let urlCheckInterval;

// Function to start URL polling
function startUrlPolling() {
  // Clear any existing interval
  if (urlCheckInterval) {
    clearInterval(urlCheckInterval);
  }
  
  // Poll every 500ms for URL changes
  urlCheckInterval = setInterval(() => {
    if (currentUrl !== window.location.href) {
      const oldUrl = currentUrl;
      currentUrl = window.location.href;
      console.log('🔍 URL changed from:', oldUrl, 'to:', currentUrl);
      
      // Multiple checks with different delays to ensure page content is loaded
      setTimeout(handlePageChange, 500);
      setTimeout(handlePageChange, 1000);
      setTimeout(handlePageChange, 2000);
    }
  }, 500);
}

// Enhanced MutationObserver for DOM changes
const pageObserver = new MutationObserver((mutations) => {
  // Check for significant page changes
  let significantChange = false;
  
  mutations.forEach((mutation) => {
    // Look for changes that might indicate page navigation
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check for main content containers or navigation elements
          if (node.classList && (
            node.classList.contains('page-content') ||
            node.classList.contains('main-content') ||
            node.tagName === 'MAIN' ||
            node.id === 'main' ||
            (node.innerHTML && node.innerHTML.includes('purchase'))
          )) {
            significantChange = true;
          }
        }
      });
    }
  });
  
  if (significantChange) {
    console.log('📄 Significant page change detected');
    setTimeout(handlePageChange, 1000);
    setTimeout(handlePageChange, 2000);
  }
});

// Start observing with broader scope
if (document.body) {
  pageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    attributeOldValue: false,
    characterData: false,
    characterDataOldValue: false
  });
}

// Listen for various navigation events
window.addEventListener('popstate', () => {
  console.log('🔙 Popstate event detected');
  setTimeout(handlePageChange, 500);
  setTimeout(handlePageChange, 1500);
});

// Listen for pushstate/replacestate (common in SPAs)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(history, args);
  console.log('🔄 PushState detected');
  setTimeout(handlePageChange, 500);
  setTimeout(handlePageChange, 1500);
};

history.replaceState = function(...args) {
  originalReplaceState.apply(history, args);
  console.log('🔄 ReplaceState detected');
  setTimeout(handlePageChange, 500);
  setTimeout(handlePageChange, 1500);
};

// Listen for hashchange
window.addEventListener('hashchange', () => {
  console.log('🔗 Hash change detected');
  setTimeout(handlePageChange, 500);
});

// Start URL polling
startUrlPolling();

// Initial check and setup with multiple attempts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    handlePageChange();
    setTimeout(handlePageChange, 1000);
    setTimeout(handlePageChange, 3000);
  });
} else {
  handlePageChange();
  setTimeout(handlePageChange, 1000);
  setTimeout(handlePageChange, 3000);
}

// Also check periodically in case we miss navigation
setInterval(() => {
  if (isPurchaseHistoryPage() && !document.getElementById('shopee-extension-container')) {
    console.log('🔄 Periodic check: Extension missing on purchase page, reinitializing...');
    handlePageChange();
  }
}, 5000); // Check every 5 seconds