

# Microsoft Clarity Integration

## Overview
Add Microsoft Clarity analytics tracking to the website by inserting the provided snippet into `index.html`.

## What is Clarity?
Microsoft Clarity is a free analytics tool that provides:
- Session recordings (see how users interact with your site)
- Heatmaps (where users click and scroll)
- Insights on user behavior patterns

## Changes Required

### File: `index.html`

Add the Clarity tracking script inside the `<head>` section, after the existing meta tags:

```html
<!-- Microsoft Clarity Analytics -->
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "mmcpq54i6d");
</script>
```

## How It Works
- The script loads asynchronously (won't slow down page load)
- Automatically tracks all page views across all routes
- No additional configuration needed per route
- Data will appear in your Clarity dashboard within a few hours

## Privacy Note
Clarity automatically masks sensitive input fields by default. You can configure additional masking rules in your Clarity dashboard under Settings → Masking if needed.

