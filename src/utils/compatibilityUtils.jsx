import React from 'react';
import { useCompatibility } from '../hooks/useCompatibility';

/**
 * Higher-order component for compatibility-aware components
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Enhanced component with compatibility props
 */
export const withCompatibility = (WrappedComponent) => {
    const CompatibilityEnhancedComponent = (props) => {
        const compatibility = useCompatibility();

        return (
            <WrappedComponent
                {...props}
                compatibility={compatibility}
            />
        );
    };

    CompatibilityEnhancedComponent.displayName =
        `withCompatibility(${WrappedComponent.displayName || WrappedComponent.name})`;

    return CompatibilityEnhancedComponent;
};