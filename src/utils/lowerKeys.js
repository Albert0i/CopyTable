
const lowerObjKey = (obj) => {
    let newObj = {};
  
    Object.keys(obj).forEach(key => {
      newObj[key.toLowerCase()] = obj[key];
    });
  
    return newObj;
}

const lowerObjKeyArray = (objs) => {
    let newObjArray = []
    for (i=0; i< objs.length; i++)
        newObjArray.push(lowerObjKey(objs[i]))
    return newObjArray
}

export { lowerObjKey, lowerObjKeyArray } 

/*
   How to Lowercase all Keys in an Object using JavaScript
   https://bobbyhadz.com/blog/javascript-lowercase-object-keys
*/