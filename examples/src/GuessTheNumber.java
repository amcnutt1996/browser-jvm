import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Random;

public class GuessTheNumber {
    public static void main(String[] args) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        int secret = new Random().nextInt(100) + 1;
        System.out.println("I'm thinking of a number between 1 and 100.");
        for (int tries = 1; ; tries++) {
            System.out.print("Your guess: ");
            System.out.flush();
            String line = in.readLine();
            if (line == null) {
                System.out.println();
                System.out.println("Bye! It was " + secret + ".");
                return;
            }
            int guess;
            try {
                guess = Integer.parseInt(line.trim());
            } catch (NumberFormatException e) {
                System.out.println("That's not a number.");
                continue;
            }
            if (guess < secret) {
                System.out.println("Higher.");
            } else if (guess > secret) {
                System.out.println("Lower.");
            } else {
                System.out.println("Got it in " + tries + (tries == 1 ? " try!" : " tries!"));
                return;
            }
        }
    }
}
