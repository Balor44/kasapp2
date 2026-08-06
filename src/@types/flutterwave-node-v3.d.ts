declare module 'flutterwave-node-v3' {
  class Flutterwave {
    constructor(publicKey: string, secretKey: string);
    Payment: {
      generate(payload: any): Promise<any>;
    };
  }
  export default Flutterwave;
}