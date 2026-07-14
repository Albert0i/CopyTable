
const toBoolean = (dataStr) => {
    return !!(dataStr?.toLowerCase?.() === 'true' || dataStr === true);
  };

export { toBoolean };
  
/*
   Proper way to parse environment variables
   https://stackoverflow.com/questions/59599304/proper-way-to-parse-environment-variables
*/