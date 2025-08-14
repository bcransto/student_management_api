// Layout Editor Iframe Component
// Embeds the layout editor within the SPA using an iframe

const LayoutEditorIframe = ({ layoutId, mode, onBack }) => {
  const [loading, setLoading] = React.useState(true);
  
  // Build the URL for the iframe
  const getEditorUrl = () => {
    let url = '/layout-editor/';
    const params = [];
    
    if (layoutId && layoutId !== 'new') {
      params.push(`layout=${layoutId}`);
    }
    
    if (mode) {
      params.push(`mode=${mode}`);
    }
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    return url;
  };
  
  const handleIframeLoad = () => {
    setLoading(false);
    console.log('Layout editor iframe loaded');
  };
  
  return React.createElement(
    'div',
    { 
      style: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f3f4f6'
      }
    },
    
    // Header bar with back button
    React.createElement(
      'div',
      {
        style: {
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }
      },
      
      // Back button
      React.createElement(
        'button',
        {
          className: 'btn btn-secondary btn-sm',
          onClick: onBack,
          style: { 
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }
        },
        React.createElement('span', { style: { fontSize: '18px' } }, '←'),
        'Back to Layouts'
      ),
      
      // Title
      React.createElement(
        'h2',
        { 
          style: { 
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111827'
          }
        },
        layoutId === 'new' ? 'Create New Layout' : `Edit Layout #${layoutId}`
      ),
      
      // Loading indicator
      loading && React.createElement(
        'span',
        {
          style: {
            marginLeft: 'auto',
            color: '#6b7280',
            fontSize: '0.875rem'
          }
        },
        'Loading editor...'
      )
    ),
    
    // Iframe container
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          position: 'relative',
          overflow: 'hidden'
        }
      },
      
      // Loading overlay
      loading && React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }
        },
        React.createElement(
          'div',
          { style: { textAlign: 'center' } },
          React.createElement('div', { className: 'spinner' }),
          React.createElement('p', { style: { marginTop: '1rem', color: '#6b7280' } }, 'Loading layout editor...')
        )
      ),
      
      // The iframe
      React.createElement('iframe', {
        src: getEditorUrl(),
        style: {
          width: '100%',
          height: '100%',
          border: 'none'
        },
        onLoad: handleIframeLoad,
        title: 'Layout Editor'
      })
    )
  );
};

// Export the component
if (typeof window !== 'undefined') {
  window.LayoutEditorIframe = LayoutEditorIframe;
  console.log('LayoutEditorIframe component loaded');
}