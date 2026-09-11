import { useLayoutEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import './styles/product-theme.css';

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
// Tokyo Night: navy surfaces, lavender actions and distinct semantic statuses.
// Explicit alias tokens preserve contrast when using Ant Design's dark algorithm.
// Shared by all WareOnGo controls; native Mapbox UI is isolated in the CSS layer.
const productTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    fontFamily, borderRadius: 6,
    colorBgLayout: '#16161e', colorBgContainer: '#1a1b26', colorBgElevated: '#24283b',
    colorBorder: '#68729a', colorBorderSecondary: '#343b58',
    colorText: '#c0caf5', colorTextSecondary: '#a9b1d6', colorTextTertiary: '#929bb9',
    colorTextQuaternary: '#929bb9', colorTextPlaceholder: '#929bb9',
    colorPrimary: '#bb9af7', colorPrimaryHover: '#cdb4ff', colorPrimaryActive: '#a880eb',
    colorPrimaryBg: '#322b4a', colorPrimaryBgHover: '#40365c', colorPrimaryBorder: '#8064ad',
    colorPrimaryText: '#bb9af7', colorPrimaryTextHover: '#cdb4ff', colorPrimaryTextActive: '#a880eb',
    colorLink: '#bb9af7', colorLinkHover: '#cdb4ff', colorLinkActive: '#a880eb',
    colorSuccess: '#9ece6a', colorSuccessText: '#9ece6a',
    colorWarning: '#e0af68', colorWarningText: '#e0af68',
    colorError: '#f7768e', colorErrorText: '#f7768e', colorErrorHover: '#ff9bb0',
    colorInfo: '#bb9af7', colorInfoText: '#bb9af7',
    colorBgMask: 'rgba(0, 0, 0, 0.65)',
    boxShadow: 'none', boxShadowSecondary: 'none', boxShadowTertiary: 'none',
  },
  components: {
    Button: {
      primaryColor: '#16161e', dangerColor: '#16161e', defaultColor: '#c0caf5',
      primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none',
    },
    Radio: { dotColorDisabled: '#68729a', buttonSolidCheckedColor: '#16161e' },
    Switch: { handleShadow: 'none' },
    Card: { colorBgContainer: '#1f2335' },
    DatePicker: { colorTextLightSolid: '#16161e' },
    Select: { optionSelectedBg: '#322b4a', optionSelectedColor: '#c0caf5' },
    Segmented: { itemSelectedBg: '#322b4a', itemSelectedColor: '#cdb4ff' },
    Menu: { itemSelectedBg: '#322b4a', itemSelectedColor: '#cdb4ff' },
    Skeleton: { gradientFromColor: '#3b405b', gradientToColor: '#4a506c' },
  },
};

export default function ProductTheme({ children }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.ui = 'product';
    return () => { delete document.documentElement.dataset.ui; };
  }, []);
  return <ConfigProvider theme={productTheme}>{children}</ConfigProvider>;
}
