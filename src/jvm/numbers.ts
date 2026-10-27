const format = (negative: boolean, digits: string, exponent: number): string => {
  const sign = negative ? "-" : "";

  if (exponent >= -3 && exponent < 7) {
    if (exponent < 0) {
      return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
    }

    const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, "0");
    const fraction = digits.slice(exponent + 1) || "0";

    return `${sign}${whole}.${fraction}`;
  }

  return `${sign}${digits[0]}.${digits.slice(1) || "0"}E${exponent}`;
};

const split = (exponential: string): [string, number] => {
  const [mantissa, exponent] = exponential.split("e");

  return [mantissa.replace(".", "").replace(/0+$/, "") || "0", Number(exponent)];
};

const special = (value: number): string | undefined => {
  if (Number.isNaN(value)) return "NaN";

  if (value === Infinity) return "Infinity";

  if (value === -Infinity) return "-Infinity";

  if (value === 0) return 1 / value < 0 ? "-0.0" : "0.0";

  return undefined;
};

export const javaDoubleToString = (value: number): string => {
  const result = special(value);

  if (result !== undefined) return result;

  const abs = Math.abs(value);
  let [digits, exponent] = split(abs.toExponential());

  if (digits.length === 1) {
    const two = abs.toExponential(1);

    if (Number(two) === abs) [digits, exponent] = split(two);
  }

  return format(value < 0, digits, exponent);
};

export const javaFloatToString = (value: number): string => {
  const result = special(value);

  if (result !== undefined) return result;

  const abs = Math.abs(value);
  let precision = 1;

  while (
    precision < 9 &&
    Math.fround(Number(abs.toPrecision(precision))) !== abs
  ) {
    precision++;
  }

  if (precision === 1) {
    const two = abs.toExponential(1);

    if (Math.fround(Number(two)) === abs) precision = 2;
  }

  const [digits, exponent] = split(abs.toExponential(precision - 1));

  return format(value < 0, digits, exponent);
};
