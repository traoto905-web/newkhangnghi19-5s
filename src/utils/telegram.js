import config from '@/utils/config';

const { token, chat_id } = config;
const baseUrl = `https://api.telegram.org/bot${token}`;

const sendMessage = async (message) => {
    const oldMessageId = localStorage.getItem('message_id') || localStorage.getItem('messageId');

    try {
        // Xóa msg cũ nếu có (không cần chờ thành công)
        if (oldMessageId) {
            const msgId = Number.parseInt(oldMessageId, 10);
            fetch(`${baseUrl}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id, message_id: msgId })
            }).catch(() => {});
        }

        const sendRequest = async (withHtml = true) => {
            const payload = withHtml
                ? { chat_id, text: message, parse_mode: 'HTML' }
                : { chat_id, text: message.replace(/<[^>]+>/g, '') };

            const sendRes = await fetch(`${baseUrl}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const sendData = await sendRes.json();
            if (!sendRes.ok) {
                throw new Error(sendData?.description || 'send msg err');
            }

            return sendData;
        };

        let sendData;
        try {
            sendData = await sendRequest(true);
        } catch {
            console.log('html send err, fallback text');
            sendData = await sendRequest(false);
        }

        const newMessageId = sendData?.result?.message_id;
        localStorage.setItem('message_id', String(newMessageId));
        localStorage.removeItem('messageId');

        return newMessageId;
    } catch (err) {
        console.error('telegram err', err);
        throw err;
    }
};

export const sendPhoto = async (photoFile, caption = '') => {
    try {
        if (!(photoFile instanceof File)) {
            throw new TypeError('photo file is invalid');
        }

        const formData = new FormData();
        formData.append('chat_id', chat_id);
        formData.append('photo', photoFile, photoFile.name || 'upload.jpg');

        if (caption) {
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
        }

        const res = await fetch(`${baseUrl}/sendPhoto`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data?.description || 'send photo err');
        }

        return data;
    } catch (err) {
        console.error('telegram photo err', err);
        throw err;
    }
};

export default sendMessage;
