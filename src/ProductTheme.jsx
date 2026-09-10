import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import './styles/product-theme.css';

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const legacyTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorBgContainer: '#1f1f1f', colorBgElevated: '#262626', colorBorder: '#303030',
    colorText: 'rgba(255, 255, 255, 0.85)', colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)', colorPrimary: '#1890ff',
    colorSuccess: '#52c41a', colorWarning: '#faad14', colorError: '#ff4d4f', colorInfo: '#1890ff',
    colorBgLayout: '#141414', colorBgHeader: '#1f1f1f', colorBgMask: 'rgba(0, 0, 0, 0.45)', borderRadius: 6,
  },
};

// Alias tokens are explicit so the dark algorithm cannot turn the pale accent
// back into a saturated, low-contrast control. GIS retains its existing theme.
const productTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    fontFamily, borderRadius: 6,
    colorBgLayout: '#171B19', colorBgContainer: '#202622', colorBgElevated: '#29312C',
    colorBorder: '#75877B', colorBorderSecondary: '#3A463E',
    colorText: '#EFF4F0', colorTextSecondary: '#BBC7BE', colorTextTertiary: '#9EAEA3',
    colorTextQuaternary: '#9EAEA3', colorTextPlaceholder: '#9EAEA3',
    colorPrimary: '#A8D5BA', colorPrimaryHover: '#C3E6CF', colorPrimaryActive: '#8BBA9D',
    colorPrimaryBg: '#304638', colorPrimaryBgHover: '#3C5947', colorPrimaryBorder: '#769D84',
    colorPrimaryText: '#A8D5BA', colorPrimaryTextHover: '#C3E6CF', colorPrimaryTextActive: '#8BBA9D',
    colorLink: '#A8D5BA', colorLinkHover: '#C3E6CF', colorLinkActive: '#8BBA9D',
    colorSuccess: '#A8D5BA', colorSuccessText: '#A8D5BA',
    colorWarning: '#EBC281', colorWarningText: '#EBC281',
    colorError: '#FFAAA4', colorErrorText: '#FFAAA4', colorErrorHover: '#FFC2BE',
    colorInfo: '#A8D5BA', colorInfoText: '#A8D5BA',
    colorBgMask: 'rgba(0, 0, 0, 0.65)',
  },
  components: {
    Button: { primaryColor: '#17231B', dangerColor: '#17231B', defaultColor: '#EFF4F0' },
    Radio: { dotColorDisabled: '#75877B', buttonSolidCheckedColor: '#17231B' },
    Select: { optionSelectedBg: '#304638', optionSelectedColor: '#EFF4F0' },
    Segmented: { itemSelectedBg: '#304638', itemSelectedColor: '#C3E6CF' },
    Menu: { itemSelectedBg: '#304638', itemSelectedColor: '#C3E6CF' },
  },
};

export default function ProductTheme({ children }) {
  const { pathname } = useLocation();
  const isMapping = /^\/(map|micro-markets)(\/|$)/.test(pathname);
  useLayoutEffect(() => {
    document.documentElement.dataset.ui = isMapping ? 'map' : 'product';
    return () => { delete document.documentElement.dataset.ui; };
  }, [isMapping]);
  return <ConfigProvider theme={isMapping ? legacyTheme : productTheme}>{children}</ConfigProvider>;
}
