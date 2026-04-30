/**
 * Spinner code license here (MIT): https://github.com/tobiasahlin/SpinKit/blob/master/LICENSE
 */

import React from 'react'
import PropTypes from 'prop-types'
import styled, { css, keyframes } from 'styled-components'
import { Spin as AntSpin } from 'antd'

import { grid } from '@coko/client'

const StyledSpin = styled(({ isNested, renderBackground, ...rest }) => (
  <AntSpin {...rest} />
))`
  ${props =>
    props.isNested &&
    css`
      z-index: 4;

      > div {
        position: absolute;
        left: 50%;
        top: 50%;
        margin: -20px;
      }
    `}
`

const bounce = keyframes`
  0%,
  100% {
    transform: scale(0);
  }

  50% {
    transform: scale(1);
  }
`

const IndicatorWrapper = styled.div`
  height: ${props => grid(props.size)};
  position: relative;
  width: ${props => grid(props.size)};
`

const BounceOne = styled.div`
  animation: ${bounce} 2s infinite ease-in-out;
  background-color: ${props => props.theme.colorPrimary};
  border-radius: 50%;
  height: 100%;
  left: 0;
  opacity: 0.6;
  position: absolute;
  top: 0;
  width: 100%;
`

const BounceTwo = styled(BounceOne)`
  animation-delay: -1s;
`

const NestedWrapper = styled.div`
  height: 100vh;

  .ant-spin-nested-loading {
    height: 100%;

    > div {
      height: 100%;

      > div.ant-spin-spinning {
        height: 100%;
      }
    }
  }
`

/* eslint-disable-next-line react/prop-types */


/* Animations */
const pulse = keyframes`
  0%,100% { transform: scale(1); filter: drop-shadow(0 2px 6px rgba(0,0,0,.12)); }
  50%     { transform: scale(1.01); filter: drop-shadow(0 4px 12px rgba(0,0,0,.16)); }
`;
const shimmerText = keyframes`
  to { background-position: 200% 0; }
`;
const sheenSlide = keyframes`
  0%   { transform: translateX(-160%) rotate(16deg); }
  100% { transform: translateX(160%)  rotate(16deg); }
`;

/* Optional root overlay if needed for fullscreen (not used below, but included for completeness) */
const Root = styled.div`
  display: grid;
  place-items: center;
  gap: ${grid(1.5)};
`;

const Wrapper = styled.div`
  --size: ${({ size }) => grid(size * 2)};
  height: var(--size);
  width: var(--size);
  position: relative;
  display: grid;
  place-items: center;
`;

const LogoBox = styled.div`
  height: 100%;
  width: 100%;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  isolation: isolate;
  animation: ${pulse} 1.8s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  &::after {
    content: "";
    position: absolute;
    inset: -10% -30%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.06) 35%,
      rgba(255, 255, 255, 0.18) 50%,
      rgba(255, 255, 255, 0.06) 65%,
      rgba(255, 255, 255, 0) 100%
    );
    mix-blend-mode: screen;
    animation: ${sheenSlide} 1.7s ease-in-out infinite;

    @media (prefers-reduced-motion: reduce) {
      animation: none;
      opacity: 0;
    }
  }
`;

const LogoImg = styled.img`
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
  display: block;
  object-fit: contain;
`;

const LoadingText = styled.div`
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: ${({ theme }) => theme?.colorPrimary || "#5B8DEF"};
  text-transform: uppercase;
  background: linear-gradient(90deg, currentColor, rgba(127,127,127,.45), currentColor);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  background-size: 200% 100%;
  animation: ${shimmerText} 1.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    color: ${({ theme }) => theme?.colorPrimary || "#5B8DEF"};
    -webkit-background-clip: initial;
    background-clip: initial;
  }
`;

const A11yLive = styled.span`
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;

/**
 * Props:
 * - size (number): base units (8px grid). Default: 8 (logo ~128px).
 * This version only uses size (others can be added if desired).
 */
const Indicator = ({
  size = 8,
  text = null,
  logoSrc = "https://res.cloudinary.com/dva7ofiuu/image/upload/v1761577308/bookhub_bmehkx.png",
}) => {
  return (
    <Root role="status" aria-live="polite" aria-busy="true">
      <Wrapper size={size}>
        <LogoBox>
          <LogoImg src={logoSrc} alt="" />
        </LogoBox>
      </Wrapper>
      {text ? <LoadingText>{text}</LoadingText> : null}
      <A11yLive>Loading…</A11yLive>
    </Root>
  );
};

const Spin = props => {
  const { className, children, renderBackground, size, spinning, ...rest } =
    props

  const showChildren = renderBackground || (!renderBackground && !spinning)

  const spin = (
    <StyledSpin
      className={className}
      indicator={<Indicator size={size} />}
      isNested={!!children}
      renderBackground={renderBackground}
      spinning={spinning}
      {...rest}
    >
      {showChildren && children}
    </StyledSpin>
  )

  if (!showChildren) return <NestedWrapper>{spin}</NestedWrapper>
  return spin
}

Spin.propTypes = {
  size: PropTypes.number,
  spinning: PropTypes.bool.isRequired,
  renderBackground: PropTypes.bool,
}

Spin.defaultProps = {
  size: 10,
  renderBackground: true,
}

export default Spin

