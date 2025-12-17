import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <h2 style={{ color: '#b91c1c' }}>An error occurred while rendering the app.</h2>
          <p>Please share the details below; I'll fix it right away.</p>
          <div style={{ marginTop: 16 }}>
            <pre style={{ background: '#f9fafb', padding: 12, borderRadius: 8, overflow: 'auto' }}>
              {String(this.state.error)}
            </pre>
            {this.state.info && (
              <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 8 }}>
                {this.state.info.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
