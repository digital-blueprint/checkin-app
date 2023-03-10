import {css} from 'lit';

export function getCheckinCss() {
    // language=css
    return css`
        h2:first-child {
            margin-top: 0;
        }

        h2 {
            margin-bottom: 10px;
        }

        .border {
            margin-top: 2rem;
            border-top: var(--dbp-border);
        }

        .container {
            margin-top: 2rem;
        }

        .loading {
            text-align: center;
            display: flex;
            padding: 30px;
        }

        @media only screen and (orientation: portrait) and (max-width: 768px) {
            .inline-block {
                width: 100%;
            }
        }
    `;
}
