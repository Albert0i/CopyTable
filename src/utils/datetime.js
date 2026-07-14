
const yyyymmdd = () => {
    let today = new Date()
    return Number(today.getFullYear() + 
                  pad(today.getMonth()+1, 2) + 
                  pad(today.getDate(), 2))
}

const hhmmss = () => {
    let today = new Date()
    return Number(today.getHours() + 
                  pad(today.getMinutes(), 2) + 
                  pad(today.getSeconds(), 2))
}

function pad(num, size) {
    var s = "000000000" + num
    return s.substr(s.length-size)
}

export { yyyymmdd, hhmmss } 

/*
   How to Get Current Date & Time in JavaScript
   https://tecadmin.net/get-current-date-time-javascript/

   How to output numbers with leading zeros in JavaScript? [duplicate]
   https://stackoverflow.com/questions/2998784/how-to-output-numbers-with-leading-zeros-in-javascript
*/
