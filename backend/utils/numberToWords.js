function convertNumberToWords(amount) {
  const num = Math.floor(amount);
  if (num === 0) return 'INR Zero Only';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function numToWords(n, suffix) {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    } else {
      str += a[n];
    }
    if (n > 0) {
      str += ' ' + suffix + ' ';
    }
    return str;
  }

  let words = '';
  // Crore
  words += numToWords(Math.floor(num / 10000000), 'Crore');
  // Lakh
  words += numToWords(Math.floor((num / 100000) % 100), 'Lakh');
  // Thousand
  words += numToWords(Math.floor((num / 1000) % 100), 'Thousand');
  // Hundred
  words += numToWords(Math.floor((num / 100) % 10), 'Hundred');

  // Last 2 digits
  const last2 = num % 100;
  if (last2 > 0) {
    if (last2 > 19) {
      words += b[Math.floor(last2 / 10)] + (last2 % 10 !== 0 ? ' ' + a[last2 % 10] : '');
    } else {
      words += a[last2];
    }
  }

  // Clean double spaces
  words = words.replace(/\s+/g, ' ').trim();
  
  // Format as INR Word Only
  return `INR ${words} Only`;
}

module.exports = {
  convertNumberToWords
};
