<?php
return function ($kirby, $page) {
    $error = null;
    $success = false;

    if ($kirby->request()->is('POST')) {
        $data = [
            'name' => get('name'),
            'email' => get('email'),
            'subject' => get('subject'),
            'text' => get('text')
        ];

        $rules = [
            'name' => ['required'],
            'email' => ['required', 'email'],
            'text' => ['required']
        ];

        if ($invalid = invalid($data, $rules)) {
            $error = "Bitte fülle alle Pflichtfelder (Name, E-Mail, Nachricht) korrekt aus.";
        }
        else {
            try {
                $to = 'info@mrmimagines.ch';
                $subject = 'Anfrage Website: ' . $data['subject'];
                $msg = "Name: " . $data['name'] . "\nEmail: " . $data['email'] . "\n\nNachricht:\n" . $data['text'];
                $headers = "From: " . $data['email'] . "\r\n" .
                    "Reply-To: " . $data['email'] . "\r\n" .
                    "X-Mailer: PHP/" . phpversion();

                mail($to, $subject, $msg, $headers);
                $success = true;
            }
            catch (Exception $e) {
                $error = 'Die E-Mail konnte unerwartet nicht gesendet werden.';
            }
        }
    }
    return [
        'error' => $error,
        'success' => $success
    ];
};