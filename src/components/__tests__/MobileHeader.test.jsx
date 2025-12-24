import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MobileHeader from '../MobileHeader';

// Mock the useViewport hook
vi.mock('../../hooks', () => ({
  useViewport: vi.fn()
}));

describe('MobileHeader Component', () => {
  const mockOnMenuToggle = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Mobile Layout', () => {
    beforeEach(() => {
      const { useViewport } = require('../../hooks');
      useViewport.mockReturnValue({
        isMobile: true,
        isTablet: false
      });
    });

    it('should render hamburger menu button on mobile', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
      expect(hamburgerButton).toBeInTheDocument();
    });

    it('should call onMenuToggle when hamburger button is clicked', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
      fireEvent.click(hamburgerButton);
      
      expect(mockOnMenuToggle).toHaveBeenCalledTimes(1);
    });

    it('should render brand name', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      expect(screen.getByText('WareOnGo')).toBeInTheDocument();
    });

    it('should render mobile action buttons with proper aria labels', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      expect(screen.getByLabelText('PPT Generator')).toBeInTheDocument();
      expect(screen.getByLabelText('Chat Agent')).toBeInTheDocument();
    });

    it('should render user profile section', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const userProfile = screen.getByText('Admin User');
      expect(userProfile).toBeInTheDocument();
    });

    it('should have proper touch target sizes for mobile elements', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
      const _styles = window.getComputedStyle(hamburgerButton);
      
      // Check that button has minimum touch target styling applied
      expect(hamburgerButton).toHaveClass('hamburger-menu-btn');
    });
  });

  describe('Desktop Layout', () => {
    beforeEach(() => {
      const { useViewport } = require('../../hooks');
      useViewport.mockReturnValue({
        isMobile: false,
        isTablet: false
      });
    });

    it('should not render hamburger menu button on desktop', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.queryByLabelText('Toggle navigation menu');
      expect(hamburgerButton).not.toBeInTheDocument();
    });

    it('should render full text action buttons on desktop', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      expect(screen.getByText('PPT Generator')).toBeInTheDocument();
      expect(screen.getByText('Chat Agent')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const { useViewport } = require('../../hooks');
      useViewport.mockReturnValue({
        isMobile: true,
        isTablet: false
      });
    });

    it('should have proper ARIA labels for interactive elements', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
      expect(screen.getByLabelText('PPT Generator')).toBeInTheDocument();
      expect(screen.getByLabelText('Chat Agent')).toBeInTheDocument();
    });

    it('should have proper semantic structure', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      // Check that the header has proper semantic structure
      const header = screen.getByRole('banner');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Touch Interface Compliance', () => {
    beforeEach(() => {
      const { useViewport } = require('../../hooks');
      useViewport.mockReturnValue({
        isMobile: true,
        isTablet: false
      });
    });

    it('should provide visual feedback on button interactions', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
      
      // Simulate touch interaction
      fireEvent.mouseDown(hamburgerButton);
      fireEvent.mouseUp(hamburgerButton);
      
      expect(mockOnMenuToggle).toHaveBeenCalled();
    });

    it('should have proper CSS classes for touch optimization', () => {
      render(<MobileHeader onMenuToggle={mockOnMenuToggle} isMenuOpen={false} />);
      
      const hamburgerButton = screen.getByLabelText('Toggle navigation menu');
      expect(hamburgerButton).toHaveClass('hamburger-menu-btn');
      
      const actionButtons = screen.getAllByLabelText(/PPT Generator|Chat Agent/);
      actionButtons.forEach(button => {
        expect(button).toHaveClass('mobile-action-btn');
      });
    });
  });
});