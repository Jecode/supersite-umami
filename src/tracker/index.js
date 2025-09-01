// Umami Analytics Tracking Script
// This is an IIFE (Immediately Invoked Function Expression) that creates an isolated scope
// for the tracking functionality to avoid polluting the global namespace
(window => {
  // Extract necessary browser APIs and properties from the window object
  // These are the core browser features we need for tracking
  const {
    screen: { width, height }, // Screen dimensions for device tracking
    navigator: { language, doNotTrack: ndnt, msDoNotTrack: msdnt }, // User preferences and browser info
    location, // Current page location information
    document, // DOM access for event handling
    history, // Browser history API for SPA navigation tracking
    top, // Reference to top-level window (for iframe contexts)
    doNotTrack, // Standard Do Not Track preference
  } = window;

  // Get the current script tag and referrer information
  const { currentScript, referrer } = document;

  // Early exit if script tag is not available (shouldn't happen in normal circumstances)
  if (!currentScript) return;

  // Extract location properties for URL tracking
  const { hostname, href, origin } = location;

  // Disable localStorage for data: URLs (used in some email contexts)
  const localStorage = href.startsWith('data:') ? undefined : window.localStorage;

  // String constants to avoid repetition and enable minification
  const _data = 'data-';
  const _false = 'false';
  const _true = 'true';

  // Bind getAttribute method for easier access to script tag attributes
  const attr = currentScript.getAttribute.bind(currentScript);

  // Read configuration from script tag data attributes
  const website = attr(_data + 'website-id'); // Required: Umami website ID
  const hostUrl = attr(_data + 'host-url'); // Optional: Custom API host URL
  const beforeSend = attr(_data + 'before-send'); // Optional: Callback function name to modify data before sending
  const tag = attr(_data + 'tag') || undefined; // Optional: Custom tag for filtering
  const autoTrack = attr(_data + 'auto-track') !== _false; // Enable/disable automatic page view tracking
  const dnt = attr(_data + 'do-not-track') === _true; // Respect Do Not Track when explicitly enabled
  const excludeSearch = attr(_data + 'exclude-search') === _true; // Remove query parameters from URLs
  const excludeHash = attr(_data + 'exclude-hash') === _true; // Remove hash fragments from URLs
  const domain = attr(_data + 'domains') || ''; // Comma-separated list of allowed domains
  const domains = domain.split(',').map(n => n.trim()); // Parse domains into array

  // Determine the API endpoint URL
  // Priority: custom hostUrl > build-time replacement > script src directory
  const host =
    hostUrl || '__COLLECT_API_HOST__' || currentScript.src.split('/').slice(0, -1).join('/');
  const endpoint = `${host.replace(/\/$/, '')}__COLLECT_API_ENDPOINT__`;

  // Format screen resolution as string for tracking
  const screen = `${width}x${height}`;

  // Regular expression to extract custom event data attributes
  const eventRegex = /data-umami-event-([\w-_]+)/;
  const eventNameAttribute = _data + 'umami-event'; // Attribute that defines event name
  const delayDuration = 300; // Delay in ms before tracking SPA route changes

  /* Helper functions */

  // Creates the base payload object sent with every tracking request
  // This contains all the standard tracking data points
  const getPayload = () => ({
    website, // Website ID from script attribute
    screen, // Screen resolution (e.g., "1920x1080")
    language, // Browser language preference
    title: document.title, // Current page title
    hostname, // Current domain/hostname
    url: currentUrl, // Current page URL (may be modified by exclude options)
    referrer: currentRef, // Referrer URL (empty if from same origin)
    tag, // Optional custom tag for filtering
    id: identity ? identity : undefined, // User identity if set via identify()
  });

  // Checks if Do Not Track is enabled in the browser
  // Supports multiple browser implementations of DNT
  const hasDoNotTrack = () => {
    const dnt = doNotTrack || ndnt || msdnt;
    // DNT can be 1, "1", or "yes" depending on browser
    return dnt === 1 || dnt === '1' || dnt === 'yes';
  };

  /* Event handlers */

  // Handles browser history changes (for Single Page Applications)
  // Called when pushState or replaceState is used to change the URL
  const handlePush = (_state, _title, url) => {
    if (!url) return;

    // Store the current URL as the new referrer
    currentRef = currentUrl;
    // Create a new URL object to properly handle relative URLs
    currentUrl = new URL(url, location.href);

    // Apply URL filtering options if configured
    if (excludeSearch) currentUrl.search = ''; // Remove query parameters
    if (excludeHash) currentUrl.hash = ''; // Remove hash fragment
    currentUrl = currentUrl.toString();

    // Only track if the URL actually changed (prevents duplicate tracking)
    if (currentUrl !== currentRef) {
      // Delay tracking to allow the page to finish updating
      setTimeout(track, delayDuration);
    }
  };

  // Sets up hooks to intercept browser history API calls
  // This enables tracking of SPA navigation without page reloads
  const handlePathChanges = () => {
    // Generic function to hook into existing methods
    const hook = (_this, method, callback) => {
      const orig = _this[method]; // Store original method
      return (...args) => {
        callback.apply(null, args); // Call our callback first
        return orig.apply(_this, args); // Then call original method
      };
    };

    // Hook into both history methods used for navigation
    history.pushState = hook(history, 'pushState', handlePush);
    history.replaceState = hook(history, 'replaceState', handlePush);
  };

  // Sets up click event tracking for elements with umami event attributes
  const handleClicks = () => {
    // Tracks a specific element by extracting event data from its attributes
    const trackElement = async el => {
      const eventName = el.getAttribute(eventNameAttribute);
      if (eventName) {
        const eventData = {};

        // Extract all custom event data attributes (data-umami-event-*)
        el.getAttributeNames().forEach(name => {
          const match = name.match(eventRegex);
          if (match) eventData[match[1]] = el.getAttribute(name);
        });

        // Send the event with collected data
        return track(eventName, eventData);
      }
    };

    // Main click event handler
    const onClick = async e => {
      const el = e.target; // The actual clicked element
      const parentElement = el.closest('a,button'); // Find closest interactive parent

      // If no interactive parent, check if the clicked element itself has event attributes
      if (!parentElement) return trackElement(el);

      const { href, target } = parentElement;
      // Skip if the parent doesn't have umami event attributes
      if (!parentElement.getAttribute(eventNameAttribute)) return;

      // Handle button clicks - simple case, just track the event
      if (parentElement.tagName === 'BUTTON') {
        return trackElement(parentElement);
      }

      // Handle link clicks - more complex due to navigation behavior
      if (parentElement.tagName === 'A' && href) {
        // Determine if this is an external link or opens in new tab/window
        const external =
          target === '_blank' || // Explicitly opens in new tab
          e.ctrlKey || // Ctrl+click (new tab)
          e.shiftKey || // Shift+click (new window)
          e.metaKey || // Cmd/Meta+click (new tab on Mac)
          (e.button && e.button === 1); // Middle mouse button (new tab)

        // For internal links, prevent default navigation temporarily
        if (!external) e.preventDefault();

        // Track the click event, then handle navigation
        return trackElement(parentElement).then(() => {
          if (!external) {
            // Navigate after tracking is complete
            (target === '_top' ? top.location : location).href = href;
          }
        });
      }
    };

    // Use capture phase (true) to ensure we catch clicks before other handlers
    document.addEventListener('click', onClick, true);
  };

  /* Tracking functions */

  // Determines if tracking should be disabled based on various conditions
  const trackingDisabled = () =>
    disabled || // Disabled by server response
    !website || // No website ID configured
    (localStorage && localStorage.getItem('umami.disabled')) || // User opted out via localStorage
    (domain && !domains.includes(hostname)) || // Current domain not in allowed domains list
    (dnt && hasDoNotTrack()); // Do Not Track is enabled and respected

  // Sends tracking data to the Umami API endpoint
  const send = async (payload, type = 'event') => {
    // Early exit if tracking is disabled
    if (trackingDisabled()) return;

    // Allow custom modification of payload before sending (if callback is defined)
    const callback = window[beforeSend];
    if (typeof callback === 'function') {
      payload = callback(type, payload);
    }

    // Exit if callback returned null/undefined (indicating data should not be sent)
    if (!payload) return;

    try {
      // Send data to Umami API
      const res = await fetch(endpoint, {
        keepalive: true, // Keep request alive even if page is closing
        method: 'POST',
        body: JSON.stringify({ type, payload }), // Send type and payload as JSON
        headers: {
          'Content-Type': 'application/json',
          // Include cache header if available (for session management)
          ...(typeof cache !== 'undefined' && { 'x-umami-cache': cache }),
        },
        credentials: 'omit', // Don't send cookies (GDPR compliance)
      });

      // Process server response
      const data = await res.json();
      if (data) {
        // Server can disable tracking for this session
        disabled = !!data.disabled;
        // Update cache token for subsequent requests
        cache = data.cache;
      }
    } catch (e) {
      // Silently fail - don't break the website if tracking fails
      /* no-op */
    }
  };

  // Initializes the tracking system (called once per page/session)
  const init = () => {
    if (!initialized) {
      initialized = true;
      track(); // Send initial page view
      handlePathChanges(); // Set up SPA navigation tracking
      handleClicks(); // Set up click event tracking
    }
  };

  // Main tracking function with multiple signatures for flexibility
  const track = (name, data) => {
    // Custom event with name and optional data object
    if (typeof name === 'string') return send({ ...getPayload(), name, data });
    // Direct payload object (advanced usage)
    if (typeof name === 'object') return send({ ...name });
    // Function that returns payload (dynamic data)
    if (typeof name === 'function') return send(name(getPayload()));
    // No parameters = page view tracking
    return send(getPayload());
  };

  // Associates a user identity with tracking data
  const identify = (id, data) => {
    // Set user identity if provided as string
    if (typeof id === 'string') {
      identity = id;
    }

    // Clear cache to start fresh session
    cache = '';
    // Send identify event to API
    return send(
      {
        ...getPayload(),
        data: typeof id === 'object' ? id : data, // Handle both object and separate data param
      },
      'identify', // Special event type for user identification
    );
  };

  /* Start */

  // Expose public API on window.umami (only if not already defined)
  if (!window.umami) {
    window.umami = {
      track, // Public method to track custom events
      identify, // Public method to identify users
    };
  }

  // Initialize tracking state variables
  let currentUrl = href; // Current page URL for comparison
  let currentRef = referrer.startsWith(origin) ? '' : referrer; // Referrer (empty if same origin)
  let initialized = false; // Prevents double initialization
  let disabled = false; // Can be set by server to disable tracking
  let cache; // Session cache token from server
  let identity; // User identity set via identify()

  // Auto-start tracking if enabled and conditions are met
  if (autoTrack && !trackingDisabled()) {
    if (document.readyState === 'complete') {
      // Document already loaded, initialize immediately
      init();
    } else {
      // Wait for document to finish loading
      document.addEventListener('readystatechange', init, true);
    }
  }
})(window); // End of IIFE - pass window as parameter
