ejs.renderFile(path.join(__dirname, "/views/mail.ejs"), { name: name, username: username,  password: password }, function (err, data) {
    if (err) {
        console.log(err);
        req.flash("error", "Something went wrong!");
        return res.redirect("/auth/admin-register");
    } else {
        const options = {
            from: process.env.EMAIL_ID,
            to: username,
            subject: "Movies Prime - Admin Registration Successfully",
            html: data
        }

        transporter.sendMail(options, (err, info) => {
            if (err) {
                console.log(err);
                req.flash("error", "Something went wrong!");
                return res.redirect("/auth/admin-register");
            }
            return console.log('email successfully sent to ' + username);
            
        });
    }
});


// // Step 2
// let mailOption = {
//     from: 'moviesprime.me@gmail.com',
//     to: username,
//     subject: 'Movies Prime ADMIN',
//     text: `Welcome to MOVIES PRIME - ADMIN
//     Hello ${organize_name}
//     Thankyou you for joining us.
//     Your username and  password are given below:
//     username: ${username}
//     password: ${password}
    
//     Do not share it with any one
//     thankyou
//     regards @moviesprime team
//     please <@doNotReply>.`
// }
// // Step 3
// transporter.sendMail(mailOption, (err, data)=>{
//     if(err){
//         console.log(err);
//     }else{
//         console.log('email successfully sent to ' + username);
//     }
// });
// // Node Mailer end