const questionForm = document.getElementById('question-form');

if (questionForm) {
    const status = document.getElementById('question-status');
    const button = questionForm.querySelector('button[type="submit"]');

    questionForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = '';
        button.disabled = true;
        button.textContent = 'Sending...';
        try {
            const data = new FormData(questionForm);
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.get('name'),
                    email: data.get('email'),
                    message: data.get('message'),
                    website: data.get('website'),
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(
                Array.isArray(result.errors) ? result.errors.join(' ') : 'Unable to send your question. Please try again.'
            );
            questionForm.reset();
            status.textContent = 'Your question has been sent. Thank you for getting in touch!';
            status.className = 'form-status form-status-success';
        } catch (error) {
            status.textContent = error.message;
            status.className = 'form-status form-status-error';
        } finally {
            button.disabled = false;
            button.textContent = 'Send question';
        }
    });
}
