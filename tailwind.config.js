/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Restore standard TrainQ brand colors if needed, but remove variable refs
                // Keep it simple for now to fix the bug
            },
        },
    },
    plugins: [],
}
