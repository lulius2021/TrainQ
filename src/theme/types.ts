export interface ColorTokens {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
    tabBar: string;
    inputBackground: string;
    gridLines: string;
    success: string;
    successTransparent: string;
    danger: string;
    dangerTransparent: string;
}

export interface Theme {
    mode: "dark" | "light";
    colors: ColorTokens;
}
