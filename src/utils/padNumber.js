
function padNumber(num, length) {
    return num.toString().padStart(length, '0');
}

// Examples
// console.log(padNumber(1, 3));   // Output: "001"
// console.log(padNumber(2, 3));   // Output: "002"
// console.log(padNumber(10, 3));  // Output: "010"
// console.log(padNumber(20, 3));  // Output: "020"
// console.log(padNumber(100, 3)); // Output: "100"

export { padNumber }