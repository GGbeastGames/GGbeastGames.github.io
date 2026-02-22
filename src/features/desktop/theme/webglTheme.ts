export interface WebglThemeSkin {
  wallpaper: string;
  panelTexture: string;
  button: {
    normal: string;
    hover: string;
    active: string;
    disabled: string;
  };
  accents: {
    glow: string;
    particle: string;
  };
}

export const webglThemeSkin: WebglThemeSkin = {
  wallpaper: '/Webgl/Particals/window_04.png',
  panelTexture: '/Webgl/Buttons/BqPanelBotton.png',
  button: {
    normal: '/Webgl/Buttons/Button Normal.png',
    hover: '/Webgl/Buttons/Button Hover.png',
    active: '/Webgl/Buttons/Button Active.png',
    disabled: '/Webgl/Buttons/Button Disable.png',
  },
  accents: {
    glow: '/Webgl/Particals/light_03.png',
    particle: '/Webgl/Particals/star_09.png',
  },
};

export const toThemeCssVariables = (skin: WebglThemeSkin): Record<string, string> => ({
  '--skin-wallpaper': `url("${skin.wallpaper}")`,
  '--skin-panel': `url("${skin.panelTexture}")`,
  '--skin-button-normal': `url("${skin.button.normal}")`,
  '--skin-button-hover': `url("${skin.button.hover}")`,
  '--skin-button-active': `url("${skin.button.active}")`,
  '--skin-button-disabled': `url("${skin.button.disabled}")`,
  '--skin-glow': `url("${skin.accents.glow}")`,
  '--skin-particle': `url("${skin.accents.particle}")`,
});
