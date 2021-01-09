import nodemailer from 'nodemailer'

export async function sendEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: 'usmm4cf7harr2owp@ethereal.email',
      pass: 'nbeTaq41XBQ6bnqSFn',
    },
  })

  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: '"Fred Foo 👻" <foo@example.com>', // sender address
    to,
    subject,
    html,
  })

  console.log('Message sent: %s', info.messageId)
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info))
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}
