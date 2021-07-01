// show password logic

function isPassVisible(){
    var myData = document.getElementById('password');
    if(myData.type === 'password'){
        myData.type = 'text';
    }else{
        myData.type = 'password';
    }
}

function isPassandcpassVisible(){
    var myData = document.getElementById('password');
    var cpass = document.getElementById('cpassword');
    if(myData.type === 'password'){
        myData.type = 'text';
        cpass.type = 'text';
    }else{
        myData.type = 'password';
        cpass.type = 'password';
    }
}